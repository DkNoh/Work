package dev.scframework.reference.kanban;

import static dev.scframework.reference.kanban.KanbanDtos.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.*;
import dev.scframework.core.audit.*;
import dev.scframework.reference.identity.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.criteria.Predicate;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true)
public class KanbanService {
    private final KanbanAccessService access;
    private final KanbanBoardRepository boards;
    private final KanbanTaskRepository tasks;
    private final UserRepository users;
    private final KanbanReadMapper mapper;
    private final ObjectMapper json;
    private final EntityManager em;
    private final Clock clock;
    private final SecurityAuditPublisher audit;
    public KanbanService(KanbanAccessService access, KanbanBoardRepository boards, KanbanTaskRepository tasks,
            UserRepository users, KanbanReadMapper mapper, ObjectMapper json, EntityManager em, Clock clock, SecurityAuditPublisher audit) {
        this.access = access; this.boards = boards; this.tasks = tasks; this.users = users; this.mapper = mapper;
        this.json = json; this.em = em; this.clock = clock; this.audit = audit;
    }
    public List<BoardResponse> boards(Authentication authentication) {
        UserEntity actor = access.authorized(authentication);
        List<KanbanBoardEntity> rows = boards.findAllByOrderByIdAsc();
        Set<Long> ids = new HashSet<>(); rows.forEach(row -> { if (row.authorId != null) ids.add(row.authorId); });
        Map<Long, UserEntity> names = directory(ids);
        return rows.stream().map(row -> board(row, actor, names)).toList();
    }
    @Transactional public BoardResponse createBoard(BoardInput input, Authentication authentication) {
        UserEntity actor = access.authorized(authentication);
        KanbanBoardEntity board = new KanbanBoardEntity(boardTitle(input.title()), actor.getId(), now());
        boards.save(board); flush(); publish(actor, "KANBAN_BOARD_CREATE", "KANBAN_BOARD", board.id);
        return board(board, actor, Map.of(actor.getId(), actor));
    }
    @Transactional public BoardResponse renameBoard(long id, BoardRenameInput input, Authentication authentication) {
        UserEntity actor = access.authorized(authentication); KanbanBoardEntity board = requireBoard(id);
        if (!canRename(board, actor)) throw KanbanAccessService.forbidden();
        revision(board.revision, input.revision()); String title = boardTitle(input.title());
        if (!board.title.equals(title)) { board.rename(title, now()); flush(); publish(actor, "KANBAN_BOARD_UPDATE", "KANBAN_BOARD", id); }
        return board(board, actor, directory(board.authorId == null ? Set.of() : Set.of(board.authorId)));
    }
    public List<TaskResponse> list(String q, Status status, Priority priority, Long assigneeId, View view, Long boardId, Authentication authentication) {
        UserEntity actor = access.authorized(authentication); long selectedBoard = requireBoard(boardId == null ? 1 : boardId).id;
        if (q == null || q.length() > 200 || assigneeId != null && assigneeId <= 0) throw invalid("조회 조건을 확인하세요.");
        String literal = q.strip().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        var found = tasks.findAll((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>(); predicates.add(cb.equal(root.get("boardId"), selectedBoard));
            if (!literal.isEmpty()) predicates.add(cb.or(cb.like(cb.lower(root.get("title")), "%" + literal + "%", '\\'), cb.like(cb.lower(root.get("description")), "%" + literal + "%", '\\')));
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (priority != null) predicates.add(cb.equal(root.get("priority"), priority));
            if (assigneeId != null) predicates.add(cb.equal(root.get("assigneeId"), assigneeId));
            if (view == View.CREATED) predicates.add(cb.equal(root.get("authorId"), actor.getId()));
            if (view == View.ASSIGNED) predicates.add(cb.equal(root.get("assigneeId"), actor.getId()));
            return cb.and(predicates.toArray(Predicate[]::new));
        }, Sort.by("position", "id"));
        return taskDtos(found);
    }
    public TaskResponse get(long id, Authentication authentication) { access.authorized(authentication); return taskDtos(List.of(requireTask(id))).getFirst(); }
    @Transactional public TaskResponse create(TaskInput input, Authentication authentication) {
        UserEntity actor = access.authorized(authentication); long board = lockBoard(input.boardId() == null ? 1 : input.boardId()).id;
        TaskCreateInput fields = fields(input); validate(fields, "");
        KanbanTaskEntity task = new KanbanTaskEntity(board, actor.getId(), endPosition(board, fields.status(), null), now());
        apply(task, fields); tasks.save(task); flush(); publish(actor, "KANBAN_TASK_CREATE", "KANBAN_TASK", task.id);
        return taskDtos(List.of(task)).getFirst();
    }
    @Transactional public TaskResponse update(long id, TaskInput input, Authentication authentication) {
        UserEntity actor = access.authorized(authentication); KanbanTaskEntity task = lockedTask(id, actor); revision(task.revision, input.revision());
        if (input.boardId() != null && !input.boardId().equals(task.boardId)) throw invalid("카드가 속한 업무 보드는 변경할 수 없습니다.");
        TaskCreateInput fields = fields(input); validate(fields, "");
        if (task.status != fields.status()) task.position = endPosition(task.boardId, fields.status(), task.id);
        apply(task, fields); task.changed(now()); flush(); publish(actor, "KANBAN_TASK_UPDATE", "KANBAN_TASK", id);
        return taskDtos(List.of(task)).getFirst();
    }
    @Transactional public void delete(long id, int expectedRevision, Authentication authentication) {
        UserEntity actor = access.authorized(authentication); KanbanTaskEntity task = lockedTask(id, actor); revision(task.revision, expectedRevision);
        tasks.delete(task); flush(); publish(actor, "KANBAN_TASK_DELETE", "KANBAN_TASK", id);
    }
    @Transactional public TaskResponse move(long id, TaskMoveInput input, Authentication authentication) {
        UserEntity actor = access.authorized(authentication); KanbanTaskEntity task = lockedTask(id, actor); revision(task.revision, input.revision());
        if (Objects.equals(input.beforeId(), id)) {
            if (task.status != input.status()) throw invalid("이동할 열과 기준 카드가 일치하지 않습니다.");
            return taskDtos(List.of(task)).getFirst();
        }
        List<KanbanTaskEntity> ordered = column(task.boardId, input.status(), id); double position;
        if (input.beforeId() == null) position = endPosition(ordered);
        else {
            int target = -1; for (int i = 0; i < ordered.size(); i++) if (ordered.get(i).id.equals(input.beforeId())) { target = i; break; }
            if (target < 0) throw invalid("기준 카드가 이동할 열에 없습니다. 보드를 새로 조회하세요.");
            double next = ordered.get(target).position, previous = target == 0 ? next - 1024d : ordered.get(target - 1).position;
            position = previous + (next - previous) / 2d;
            if (!Double.isFinite(position) || !(position > previous && position < next)) throw orderConflict();
        }
        if (task.status == input.status() && Double.compare(task.position, position) == 0) return taskDtos(List.of(task)).getFirst();
        task.position = position; task.changeStatus(input.status(), now()); task.changed(now()); flush();
        publish(actor, "KANBAN_TASK_MOVE", "KANBAN_TASK", id); return taskDtos(List.of(task)).getFirst();
    }
    @Transactional public TaskImportResult importTasks(TaskImportInput input, Authentication authentication) {
        UserEntity actor = access.authorized(authentication);
        if (input.rows() == null || input.rows().isEmpty() || input.rows().size() > 200) throw invalid("가져오기는 1~200행을 선택하세요.");
        long board = lockBoard(input.boardId()).id; List<FieldViolation> errors = new ArrayList<>(); Set<Integer> rowNumbers = new HashSet<>();
        for (int i = 0; i < input.rows().size(); i++) {
            TaskImportRow row = input.rows().get(i); String prefix = "rows[" + i + "]";
            if (!rowNumbers.add(row.rowNumber())) errors.add(new FieldViolation(prefix + ".rowNumber", "원래 시트 행 번호가 중복되었습니다."));
            errors.addAll(fieldErrors(row.input(), prefix + ".input."));
        }
        if (!errors.isEmpty()) throw new ApiException(400, "INVALID_INPUT", "가져올 행을 확인하세요.", errors);
        // 모든 행/관계/순서 계산을 먼저 검증한다. 저장 도중 실패하면 앞선 IDENTITY INSERT도 같은 TX에서 rollback한다.
        EnumMap<Status, Double> last = new EnumMap<>(Status.class); List<Double> positions = new ArrayList<>();
        for (TaskImportRow row : input.rows()) {
            Status state = row.input().status(); double position;
            if (last.containsKey(state)) { double previous = last.get(state); position = previous + 1024d; if (!Double.isFinite(position) || !(position > previous)) throw orderConflict(); }
            else position = endPosition(board, state, null);
            last.put(state, position); positions.add(position);
        }
        List<KanbanTaskEntity> created = new ArrayList<>();
        for (int i = 0; i < input.rows().size(); i++) {
            KanbanTaskEntity task = new KanbanTaskEntity(board, actor.getId(), positions.get(i), now()); apply(task, input.rows().get(i).input());
            tasks.save(task); created.add(task);
        }
        flush(); created.forEach(task -> publish(actor, "KANBAN_TASK_CREATE", "KANBAN_TASK", task.id));
        publish(actor, "KANBAN_TASK_IMPORT", "KANBAN_BOARD", board);
        return new TaskImportResult(taskDtos(created), created.size());
    }
    private List<FieldViolation> fieldErrors(TaskCreateInput input, String prefix) {
        List<FieldViolation> errors = new ArrayList<>();
        if (input.assigneeId() != null) {
            UserEntity target = users.findById(input.assigneeId()).orElse(null);
            if (target == null || !access.allowed(target)) errors.add(new FieldViolation(prefix + "assigneeId", "칸반 사용 권한이 있는 담당자를 선택하세요."));
        }
        if (input.dueDate() != null) {
            try { if (!input.dueDate().matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw new DateTimeParseException("Invalid calendar shape", "", 0); LocalDate.parse(input.dueDate()); }
            catch (DateTimeParseException failure) { errors.add(new FieldViolation(prefix + "dueDate", "유효한 마감일을 입력하세요.")); }
        }
        return errors;
    }
    private void validate(TaskCreateInput fields, String prefix) {
        List<FieldViolation> errors = fieldErrors(fields, prefix);
        if (!errors.isEmpty()) throw new ApiException(400, "INVALID_INPUT", "입력 내용을 확인하세요.", errors);
    }
    private void apply(KanbanTaskEntity task, TaskCreateInput input) {
        task.title = input.title().strip(); task.description = Objects.toString(input.description(), ""); task.priority = input.priority();
        task.assigneeId = input.assigneeId(); task.dueDate = input.dueDate();
        List<String> tags = input.tags() == null ? List.of() : input.tags().stream().map(String::strip).distinct().toList();
        try { task.tagsJson = json.writeValueAsString(tags); } catch (JsonProcessingException error) { throw new IllegalStateException("Could not serialize task tags"); }
        task.changeStatus(input.status(), now()); task.updatedAt = now();
    }
    private static TaskCreateInput fields(TaskInput input) { return new TaskCreateInput(input.title(), input.description(), input.status(), input.priority(), input.assigneeId(), input.dueDate(), input.tags()); }
    private KanbanTaskEntity lockedTask(long id, UserEntity actor) {
        KanbanTaskEntity task = requireTask(id); own(task, actor); lockBoard(task.boardId);
        // 잠금 대기 중 다른 명령이 commit했을 수 있으므로 새 revision을 확인한다.
        em.refresh(task); own(task, actor); return task;
    }
    private KanbanTaskEntity requireTask(long id) { return tasks.findById(id).orElseThrow(KanbanAccessService::missing); }
    private KanbanBoardEntity requireBoard(long id) { if (id <= 0) throw invalid("업무 보드를 확인하세요."); return boards.findById(id).orElseThrow(KanbanAccessService::missing); }
    private KanbanBoardEntity lockBoard(long id) { if (id <= 0) throw invalid("업무 보드를 확인하세요."); return boards.lockById(id).orElseThrow(KanbanAccessService::missing); }
    private List<KanbanTaskEntity> column(long board, Status status, Long excluded) { return tasks.findByBoardIdAndStatusOrderByPositionAscIdAsc(board, status).stream().filter(row -> !row.id.equals(excluded)).toList(); }
    private double endPosition(long board, Status status, Long excluded) { return endPosition(column(board, status, excluded)); }
    private double endPosition(List<KanbanTaskEntity> ordered) {
        if (ordered.isEmpty()) return 1024d; double last = ordered.getLast().position, next = last + 1024d;
        if (!Double.isFinite(next) || !(next > last)) throw orderConflict(); return next;
    }
    private List<TaskResponse> taskDtos(List<KanbanTaskEntity> rows) {
        Set<Long> ids = new HashSet<>(); for (KanbanTaskEntity row : rows) { ids.add(row.authorId); if (row.assigneeId != null) ids.add(row.assigneeId); }
        Map<Long, UserEntity> names = directory(ids);
        return rows.stream().map(row -> {
            UserEntity author = names.get(row.authorId), assigned = names.get(row.assigneeId);
            try { return mapper.task(row, author.getDisplayName(), author.getUsername(), assigned == null ? null : assigned.getDisplayName(),
                    assigned == null ? null : assigned.getUsername(), json.readValue(row.tagsJson, new TypeReference<List<String>>() {})); }
            catch (JsonProcessingException error) { throw new IllegalStateException("Stored task tags are invalid"); }
        }).toList();
    }
    private Map<Long, UserEntity> directory(Set<Long> ids) { Map<Long, UserEntity> names = new HashMap<>(); if (!ids.isEmpty()) users.findAllById(ids).forEach(user -> names.put(user.getId(), user)); return names; }
    private BoardResponse board(KanbanBoardEntity row, UserEntity actor, Map<Long, UserEntity> names) {
        UserEntity author = names.get(row.authorId);
        return mapper.board(row, author == null ? null : author.getDisplayName(), author == null ? null : author.getUsername(), canRename(row, actor));
    }
    private static boolean canRename(KanbanBoardEntity board, UserEntity actor) { return board.authorId == null ? board.id == 1 && actor.isAdmin() : board.authorId.equals(actor.getId()); }
    private static String boardTitle(String title) { if (title == null || title.strip().isEmpty() || title.strip().length() > 100) throw invalid("업무 제목은 1~100자로 입력하세요."); return title.strip(); }
    private static void own(KanbanTaskEntity task, UserEntity actor) { if (!task.authorId.equals(actor.getId())) throw KanbanAccessService.forbidden(); }
    private static void revision(int current, Integer expected) { if (expected == null || expected <= 0) throw invalid("카드 버전이 필요합니다."); if (current != expected) throw conflict(); }
    private void flush() { try { em.flush(); } catch (OptimisticLockException | OptimisticLockingFailureException failure) { throw conflict(); } }
    private void publish(UserEntity actor, String action, String type, long id) { audit.publish(new SecurityAuditEvent(actor.getUsername(), actor.getId(), now(), action, "SUCCESS", type, Long.toString(id), null, null)); }
    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MICROS); }
    private static ApiException invalid(String message) { return new ApiException(400, "INVALID_INPUT", message); }
    private static ApiException conflict() { return new ApiException(409, "REVISION_CONFLICT", "다른 변경이 먼저 저장되었습니다. 새로 조회하세요."); }
    private static ApiException orderConflict() { return new ApiException(409, "ORDER_CONFLICT", "이 위치에는 카드를 더 넣을 수 없습니다. 열의 끝으로 옮긴 뒤 다시 시도하세요."); }
}
