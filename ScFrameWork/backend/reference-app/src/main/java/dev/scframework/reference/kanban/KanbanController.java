package dev.scframework.reference.kanban;

import static dev.scframework.reference.kanban.KanbanDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/kanban")
public class KanbanController {
    private final KanbanAccessService access;
    private final KanbanService service;
    public KanbanController(KanbanAccessService access, KanbanService service) { this.access = access; this.service = service; }
    @GetMapping("/access") @Operation(operationId = "kanbanAccess") public KanbanAccessResponse access(Authentication auth) { return access.access(auth); }
    @GetMapping("/users") @Operation(operationId = "kanbanUsers") public List<KanbanUserResponse> users(Authentication auth) { return access.users(auth); }
    @GetMapping("/members") @Operation(operationId = "kanbanMembers") public List<KanbanMemberResponse> members(Authentication auth) { return access.members(auth); }
    @PutMapping("/members/{id}") @Operation(operationId = "updateKanbanMember") public KanbanMemberResponse membership(@PathVariable long id, @Valid @RequestBody KanbanMemberInput input, Authentication auth) { return access.membership(id, input.allowed(), auth); }
    @GetMapping("/boards") @Operation(operationId = "kanbanBoards") public List<BoardResponse> boards(Authentication auth) { return service.boards(auth); }
    @PostMapping("/boards") @Operation(operationId = "createKanbanBoard") public BoardResponse board(@Valid @RequestBody BoardInput input, Authentication auth) { return service.createBoard(input, auth); }
    @PutMapping("/boards/{id}") @Operation(operationId = "renameKanbanBoard") public BoardResponse rename(@PathVariable long id, @Valid @RequestBody BoardRenameInput input, Authentication auth) { return service.renameBoard(id, input, auth); }
    @GetMapping("/tasks") @Operation(operationId = "kanbanTasks") public List<TaskResponse> list(@RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) Status status, @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) Long assigneeId, @RequestParam(defaultValue = "ALL") View view,
            @RequestParam(required = false) Long boardId, Authentication auth) { return service.list(q, status, priority, assigneeId, view, boardId, auth); }
    @GetMapping("/tasks/{id}") @Operation(operationId = "kanbanTask") public TaskResponse get(@PathVariable long id, Authentication auth) { return service.get(id, auth); }
    @PostMapping("/tasks") @Operation(operationId = "createKanbanTask") public TaskResponse create(@Valid @RequestBody TaskInput input, Authentication auth) { return service.create(input, auth); }
    @PutMapping("/tasks/{id}") @Operation(operationId = "updateKanbanTask") public TaskResponse update(@PathVariable long id, @Valid @RequestBody TaskInput input, Authentication auth) { return service.update(id, input, auth); }
    @DeleteMapping("/tasks/{id}") @Operation(operationId = "deleteKanbanTask") public ResponseEntity<Void> delete(@PathVariable long id, @RequestParam int revision, Authentication auth) { service.delete(id, revision, auth); return ResponseEntity.noContent().build(); }
    @PostMapping("/tasks/{id}/move") @Operation(operationId = "moveKanbanTask") public TaskResponse move(@PathVariable long id, @Valid @RequestBody TaskMoveInput input, Authentication auth) { return service.move(id, input, auth); }
    @PostMapping("/tasks/import") @Operation(operationId = "importKanbanTasks") public TaskImportResult importTasks(@Valid @RequestBody TaskImportInput input, Authentication auth) { return service.importTasks(input, auth); }
}
