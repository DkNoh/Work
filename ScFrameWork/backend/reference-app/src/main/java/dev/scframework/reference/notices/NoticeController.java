package dev.scframework.reference.notices;
import static dev.scframework.reference.notices.NoticeDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/kanban/notices")
public class NoticeController {
 private final NoticeService service;public NoticeController(NoticeService service){this.service=service;}
 @GetMapping @Operation(operationId="kanbanNotices") public List<NoticeResponse> list(@RequestParam(defaultValue="")String q,Authentication actor){return service.list(q,actor);}
 @GetMapping("/{id}") @Operation(operationId="kanbanNotice") public NoticeResponse get(@PathVariable long id,Authentication actor){return service.get(id,actor);}
 @PostMapping @Operation(operationId="createKanbanNotice") public NoticeResponse create(@Valid @RequestBody NoticeInput input,Authentication actor){return service.create(input,actor);}
 @PutMapping("/{id}") @Operation(operationId="updateKanbanNotice") public NoticeResponse update(@PathVariable long id,@Valid @RequestBody NoticeUpdateInput input,Authentication actor){return service.update(id,input,actor);}
 @DeleteMapping("/{id}") @Operation(operationId="deleteKanbanNotice") public ResponseEntity<Void> delete(@PathVariable long id,@RequestParam int revision,Authentication actor){service.delete(id,revision,actor);return ResponseEntity.noContent().build();}
}
