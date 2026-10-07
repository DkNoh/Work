package dev.scframework.reference.documents;
import static dev.scframework.reference.documents.DocumentDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/documents")
public class DocumentController {
 private final DocumentService service;public DocumentController(DocumentService service){this.service=service;}
 @GetMapping @Operation(operationId="documents") public List<DocumentSummary> list(Authentication actor){return service.list(actor);}
 @GetMapping("/{id}") @Operation(operationId="document") public DocumentResponse get(@PathVariable long id,Authentication actor){return service.get(id,actor);}
 @PostMapping @Operation(operationId="createDocument") public DocumentResponse create(@Valid @RequestBody DocumentInput input,Authentication actor){return service.create(input,actor);}
 @PutMapping("/{id}") @Operation(operationId="updateDocument") public DocumentResponse update(@PathVariable long id,@Valid @RequestBody DocumentUpdateInput input,Authentication actor){return service.update(id,input,actor);}
 @DeleteMapping("/{id}") @Operation(operationId="deleteDocument") public ResponseEntity<Void> delete(@PathVariable long id,@RequestParam int revision,Authentication actor){service.delete(id,revision,actor);return ResponseEntity.noContent().build();}
}
