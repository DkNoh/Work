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

/**
 * 칸반 보드/작업 변경과 순서 계산의 트랜잭션 경계다.
 * 동일 보드 쓰기를 잠금으로 직렬화하고 잠금 획득 후 작업을 refresh해 revision을 재확인한다.
 * 읽기 DTO 변환은 MapStruct, 이름은 일괄 조회, 쓰기·권한·순서·감사는 이 Service가 결정한다.
 */

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
    // 보드 목록의 작성자 ID를 모아 한 번에 조회한다. canRename은 현재 actor와 보드 소유권/기본 보드 정책으로 계산한다.
    public List<BoardResponse> boards(Authentication authentication) {
        UserEntity actor = access.authorized(authentication);
        List<KanbanBoardEntity> rows = boards.findAllByOrderByIdAsc();
        Set<Long> ids = new HashSet<>(); rows.forEach(row -> { if (row.authorId != null) ids.add(row.authorId); });
        Map<Long, UserEntity> names = directory(ids);
        return rows.stream().map(row -> board(row, actor, names)).toList();
    }
    // 접근 허용자 본인을 작성자로 새 보드를 만들고 flush/감사 후 DTO를 반환한다.
    @Transactional public BoardResponse createBoard(BoardInput input, Authentication authentication) {
        UserEntity actor = access.authorized(authentication);
        KanbanBoardEntity board = new KanbanBoardEntity(boardTitle(input.title()), actor.getId(), now());
        boards.save(board); flush(); publish(actor, "KANBAN_BOARD_CREATE", "KANBAN_BOARD", board.id);
        return board(board, actor, Map.of(actor.getId(), actor));
    }
    // 작성 보드 소유자 또는 기본 보드의 ADMIN만 변경한다. revision을 검사한 뒤 제목이 실제 달라진 경우만 버전/감사를 갱신한다.
    @Transactional public BoardResponse renameBoard(long id, BoardRenameInput input, Authentication authentication) {
        UserEntity actor = access.authorized(authentication); KanbanBoardEntity board = requireBoard(id);
        if (!canRename(board, actor)) throw KanbanAccessService.forbidden();
        revision(board.revision, input.revision()); String title = boardTitle(input.title());
        if (!board.title.equals(title)) { board.rename(title, now()); flush(); publish(actor, "KANBAN_BOARD_UPDATE", "KANBAN_BOARD", id); }
        return board(board, actor, directory(board.authorId == null ? Set.of() : Set.of(board.authorId)));
    }
    // 접근권한/보드를 확인한 후 조건 Specification을 구성한다. view=CREATED/ASSIGNED는 현재 actor ID로 필터하며 저장된 position/id 순서로 반환한다.
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
    // 보드 잠금을 먼저 얻어 열 끝 위치 계산과 INSERT를 직렬화한다. 담당자 접근권한/실제 달력 날짜를 검증한 후 저장한다.
    @Transactional public TaskResponse create(TaskInput input, Authentication authentication) {
        UserEntity actor = access.authorized(authentication); long board = lockBoard(input.boardId() == null ? 1 : input.boardId()).id;
        TaskCreateInput fields = fields(input); validate(fields, "");
        KanbanTaskEntity task = new KanbanTaskEntity(board, actor.getId(), endPosition(board, fields.status(), null), now());
        apply(task, fields); tasks.save(task); flush(); publish(actor, "KANBAN_TASK_CREATE", "KANBAN_TASK", task.id);
        return taskDtos(List.of(task)).getFirst();
    }
    // lockedTask가 보드 잠금 후 최신 작업을 refresh한다. 기준 revision 검사 후 보드 변경은 금지하고 상태가 달라지면 대상 열 끝 위치를 배정한다.
    @Transactional public TaskResponse update(long id, TaskInput input, Authentication authentication) {
        UserEntity actor = access.authorized(authentication); KanbanTaskEntity task = lockedTask(id, actor); revision(task.revision, input.revision());
        if (input.boardId() != null && !input.boardId().equals(task.boardId)) throw invalid("카드가 속한 업무 보드는 변경할 수 없습니다.");
        TaskCreateInput fields = fields(input); validate(fields, "");
        if (task.status != fields.status()) task.position = endPosition(task.boardId, fields.status(), task.id);
        apply(task, fields); task.changed(now()); flush(); publish(actor, "KANBAN_TASK_UPDATE", "KANBAN_TASK", id);
        return taskDtos(List.of(task)).getFirst();
    }
    // 작성자/보드 잠금/최신 revision 확인을 마친 작업만 삭제한다. 삭제/감사는 동일 트랜잭션에 포함된다.
    @Transactional public void delete(long id, int expectedRevision, Authentication authentication) {
        UserEntity actor = access.authorized(authentication); KanbanTaskEntity task = lockedTask(id, actor); revision(task.revision, expectedRevision);
        tasks.delete(task); flush(); publish(actor, "KANBAN_TASK_DELETE", "KANBAN_TASK", id);
    }
    // 이동 대상 작업을 잠금/refresh 후 검증한다. 자기 자신 앞의 동일 열 이동은 no-op이며 기준 카드는 대상 열에 실제로 존재해야 한다.
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
            // 인접 카드의 중간 실수 위치를 배정해 전체 열을 재번호하지 않는다. 표현 가능한 간격이 없거나 비유한 값이면 ORDER_CONFLICT로 거절한다.
            position = previous + (next - previous) / 2d;
            if (!Double.isFinite(position) || !(position > previous && position < next)) throw orderConflict();
        }
        if (task.status == input.status() && Double.compare(task.position, position) == 0) return taskDtos(List.of(task)).getFirst();
        task.position = position; task.changeStatus(input.status(), now()); task.changed(now()); flush();
        publish(actor, "KANBAN_TASK_MOVE", "KANBAN_TASK", id); return taskDtos(List.of(task)).getFirst();
    }
    // 모든 행의 관계/날짜·중복 원본 행 번호·순서를 검증한 뒤 일괄 INSERT한다. 중간 실패가 앞선 IDENTITY INSERT를 commit하는 것은 아니다.
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
        // 상태별 다음 위치를 메모리에서 먼저 계산한다. 보드 잠금 안이므로 다른 요청이 같은 열 끝 위치를 동시에 배정하지 못한다.
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
    // Bean Validation으로 알 수 없는 DB 관계와 실제 달력 날짜를 검사한다. prefix는 일반 폼 또는 rows[i].input 필드 오류로 연결된다.
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
    // 검증된 업무 값을 엔티티에 적용한다. 태그는 strip/중복 제거 후 JSON 배열로 저장하여 태그 안 쉼표를 손실하지 않는다.
    private void apply(KanbanTaskEntity task, TaskCreateInput input) {
        task.title = input.title().strip(); task.description = Objects.toString(input.description(), ""); task.priority = input.priority();
        task.assigneeId = input.assigneeId(); task.dueDate = input.dueDate();
        List<String> tags = input.tags() == null ? List.of() : input.tags().stream().map(String::strip).distinct().toList();
        try { task.tagsJson = json.writeValueAsString(tags); } catch (JsonProcessingException error) { throw new IllegalStateException("Could not serialize task tags"); }
        task.changeStatus(input.status(), now()); task.updatedAt = now();
    }
    private static TaskCreateInput fields(TaskInput input) { return new TaskCreateInput(input.title(), input.description(), input.status(), input.priority(), input.assigneeId(), input.dueDate(), input.tags()); }
    // 먼저 작업 소유권을 검사하고 보드 쓰기 잠금을 얻는다. 대기 중 선행 transaction이 commit했을 수 있어 refresh 후 소유권/revision 기준을 새로 읽는다.
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
    // 끝 카드보다 1024 큰 위치를 배정한다. double 정밀도 소진/overflow를 조용히 저장하지 않고 충돌로 반환한다.
    private double endPosition(List<KanbanTaskEntity> ordered) {
        if (ordered.isEmpty()) return 1024d; double last = ordered.getLast().position, next = last + 1024d;
        if (!Double.isFinite(next) || !(next > last)) throw orderConflict(); return next;
    }
    // 작성자/담당자 이름을 일괄 조회하고 저장 태그 JSON을 배열로 복원해 DTO로 변환한다. 이 MapStruct 호출 자체는 SQL을 실행하지 않는다.
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
    // 기본 보드(ID=1, 작성자 없음)는 ADMIN, 그 외는 보드 작성자에게 이름 변경 권한이 있다. ADMIN을 모든 개인 보드 소유자로 취급하지 않는다.
    private static boolean canRename(KanbanBoardEntity board, UserEntity actor) { return board.authorId == null ? board.id == 1 && actor.isAdmin() : board.authorId.equals(actor.getId()); }
    private static String boardTitle(String title) { if (title == null || title.strip().isEmpty() || title.strip().length() > 100) throw invalid("업무 제목은 1~100자로 입력하세요."); return title.strip(); }
    private static void own(KanbanTaskEntity task, UserEntity actor) { if (!task.authorId.equals(actor.getId())) throw KanbanAccessService.forbidden(); }
    // 누락/0 이하 버전은 입력 오류, 최신 버전과 불일치는 409다. 사전 비교 이후 경쟁은 flush의 JPA 버전 검사로 한 번 더 보호한다.
    private static void revision(int current, Integer expected) { if (expected == null || expected <= 0) throw invalid("카드 버전이 필요합니다."); if (current != expected) throw conflict(); }
    // 낙관적 잠금의 JPA/Spring 예외를 동일 REVISION_CONFLICT로 정리한다. SQL을 실행하되 최종 commit 전까지 뒤 단계 실패 시 rollback 가능하다.
    private void flush() { try { em.flush(); } catch (OptimisticLockException | OptimisticLockingFailureException failure) { throw conflict(); } }
    private void publish(UserEntity actor, String action, String type, long id) { audit.publish(new SecurityAuditEvent(actor.getUsername(), actor.getId(), now(), action, "SUCCESS", type, Long.toString(id), null, null)); }
    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MICROS); }
    private static ApiException invalid(String message) { return new ApiException(400, "INVALID_INPUT", message); }
    private static ApiException conflict() { return new ApiException(409, "REVISION_CONFLICT", "다른 변경이 먼저 저장되었습니다. 새로 조회하세요."); }
    private static ApiException orderConflict() { return new ApiException(409, "ORDER_CONFLICT", "이 위치에는 카드를 더 넣을 수 없습니다. 열의 끝으로 옮긴 뒤 다시 시도하세요."); }
}
