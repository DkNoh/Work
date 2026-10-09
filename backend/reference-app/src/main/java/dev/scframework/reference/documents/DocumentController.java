package dev.scframework.reference.documents;
import static dev.scframework.reference.documents.DocumentDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * 개인 문서 목록/상세/수정/삭제 HTTP 경계다. JSON 입력을 Service에 넘기고 삭제 성공만 본문 없는 204로 반환한다.
 */
@RestController @RequestMapping("/api/documents")
public class DocumentController {
 private final DocumentService service;public DocumentController(DocumentService service){this.service=service;}
 // 목록은 본문 없는 Summary, 상세는 documentJson을 포함한 Response다. 실제 작성자 범위는 Service가 인증 actor로 강제한다.
 @GetMapping @Operation(operationId="documents") public List<DocumentSummary> list(Authentication actor){return service.list(actor);}
 @GetMapping("/{id}") @Operation(operationId="document") public DocumentResponse get(@PathVariable long id,Authentication actor){return service.get(id,actor);}
 @PostMapping @Operation(operationId="createDocument") public DocumentResponse create(@Valid @RequestBody DocumentInput input,Authentication actor){return service.create(input,actor);}
 @PutMapping("/{id}") @Operation(operationId="updateDocument") public DocumentResponse update(@PathVariable long id,@Valid @RequestBody DocumentUpdateInput input,Authentication actor){return service.update(id,input,actor);}
 // query의 revision을 삭제 기준으로 전달한다. 정상 종료는 본문 없는 204이며 오류는 성공 JSON 봉투로 감추지 않는다.
 @DeleteMapping("/{id}") @Operation(operationId="deleteDocument") public ResponseEntity<Void> delete(@PathVariable long id,@RequestParam int revision,Authentication actor){service.delete(id,revision,actor);return ResponseEntity.noContent().build();}
}
