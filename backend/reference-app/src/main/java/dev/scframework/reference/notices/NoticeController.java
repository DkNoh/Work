package dev.scframework.reference.notices;
import static dev.scframework.reference.notices.NoticeDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * 공지의 HTTP 계약을 NoticeService에 연결한다. 조회도 칸반 접근 권한을 따르고 변경은 추가로 작성자만 허용한다.
 */
@RestController @RequestMapping("/api/kanban/notices")
public class NoticeController {
 private final NoticeService service;public NoticeController(NoticeService service){this.service=service;}
 @GetMapping @Operation(operationId="kanbanNotices") public List<NoticeResponse> list(@RequestParam(defaultValue="")String q,Authentication actor){return service.list(q,actor);}
 @GetMapping("/{id}") @Operation(operationId="kanbanNotice") public NoticeResponse get(@PathVariable long id,Authentication actor){return service.get(id,actor);}
 @PostMapping @Operation(operationId="createKanbanNotice") public NoticeResponse create(@Valid @RequestBody NoticeInput input,Authentication actor){return service.create(input,actor);}
 @PutMapping("/{id}") @Operation(operationId="updateKanbanNotice") public NoticeResponse update(@PathVariable long id,@Valid @RequestBody NoticeUpdateInput input,Authentication actor){return service.update(id,input,actor);}
 // 삭제 revision은 query parameter다. Service 성공 반환 뒤 204를 내보내고 실패는 공통 오류 계약으로 전달한다.
 @DeleteMapping("/{id}") @Operation(operationId="deleteKanbanNotice") public ResponseEntity<Void> delete(@PathVariable long id,@RequestParam int revision,Authentication actor){service.delete(id,revision,actor);return ResponseEntity.noContent().build();}
}
