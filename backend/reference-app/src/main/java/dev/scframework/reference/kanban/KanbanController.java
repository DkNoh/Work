package dev.scframework.reference.kanban;

import static dev.scframework.reference.kanban.KanbanDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * 칸반 접근권한/보드/작업/이동/가져오기의 HTTP 경계다.
 * 작업 이동은 별도 명령이며 프런트 드래그 결과를 DB 순서로 그대로 신뢰하지 않고 Service에 검증을 맡긴다.
 */

@RestController @RequestMapping("/api/kanban")
public class KanbanController {
    private final KanbanAccessService access;
    private final KanbanService service;
    public KanbanController(KanbanAccessService access, KanbanService service) { this.access = access; this.service = service; }
    // 접근 여부는 authenticated 사용자에게 boolean으로 알려 프런트 Query 활성화에 쓴다. 나머지 업무 API도 Service에서 매번 접근권한을 재검사한다.
    @GetMapping("/access") @Operation(operationId = "kanbanAccess") public KanbanAccessResponse access(Authentication auth) { return access.access(auth); }
    @GetMapping("/users") @Operation(operationId = "kanbanUsers") public List<KanbanUserResponse> users(Authentication auth) { return access.users(auth); }
    @GetMapping("/members") @Operation(operationId = "kanbanMembers") public List<KanbanMemberResponse> members(Authentication auth) { return access.members(auth); }
    @PutMapping("/members/{id}") @Operation(operationId = "updateKanbanMember") public KanbanMemberResponse membership(@PathVariable long id, @Valid @RequestBody KanbanMemberInput input, Authentication auth) { return access.membership(id, input.allowed(), auth); }
    @GetMapping("/boards") @Operation(operationId = "kanbanBoards") public List<BoardResponse> boards(Authentication auth) { return service.boards(auth); }
    @PostMapping("/boards") @Operation(operationId = "createKanbanBoard") public BoardResponse board(@Valid @RequestBody BoardInput input, Authentication auth) { return service.createBoard(input, auth); }
    @PutMapping("/boards/{id}") @Operation(operationId = "renameKanbanBoard") public BoardResponse rename(@PathVariable long id, @Valid @RequestBody BoardRenameInput input, Authentication auth) { return service.renameBoard(id, input, auth); }
    // 상태/우선순위/범위는 enum으로 바인딩하고 검색어·담당자·보드는 Service에서 추가 검증한다.
    @GetMapping("/tasks") @Operation(operationId = "kanbanTasks") public List<TaskResponse> list(@RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) Status status, @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) Long assigneeId, @RequestParam(defaultValue = "ALL") View view,
            @RequestParam(required = false) Long boardId, Authentication auth) { return service.list(q, status, priority, assigneeId, view, boardId, auth); }
    @GetMapping("/tasks/{id}") @Operation(operationId = "kanbanTask") public TaskResponse get(@PathVariable long id, Authentication auth) { return service.get(id, auth); }
    @PostMapping("/tasks") @Operation(operationId = "createKanbanTask") public TaskResponse create(@Valid @RequestBody TaskInput input, Authentication auth) { return service.create(input, auth); }
    @PutMapping("/tasks/{id}") @Operation(operationId = "updateKanbanTask") public TaskResponse update(@PathVariable long id, @Valid @RequestBody TaskInput input, Authentication auth) { return service.update(id, input, auth); }
    @DeleteMapping("/tasks/{id}") @Operation(operationId = "deleteKanbanTask") public ResponseEntity<Void> delete(@PathVariable long id, @RequestParam int revision, Authentication auth) { service.delete(id, revision, auth); return ResponseEntity.noContent().build(); }
    // 드래그/키보드 이동은 같은 move API를 사용한다. 순서 계산과 revision 검사는 브라우저가 아니라 Service/DB가 수행한다.
    @PostMapping("/tasks/{id}/move") @Operation(operationId = "moveKanbanTask") public TaskResponse move(@PathVariable long id, @Valid @RequestBody TaskMoveInput input, Authentication auth) { return service.move(id, input, auth); }
    // XLSX 바이트 자체가 아니라 사용자가 검토한 행 DTO를 받는다. 모든 행 검증/저장은 Service의 단일 트랜잭션으로 수행한다.
    @PostMapping("/tasks/import") @Operation(operationId = "importKanbanTasks") public TaskImportResult importTasks(@Valid @RequestBody TaskImportInput input, Authentication auth) { return service.importTasks(input, auth); }
}
