package __JAVA_PACKAGE__.notes;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/*
 * 생성 앱 소유 Notes REST 입력 경계다. @RestController는 DTO를 JSON으로 반환하며 JSP view를 렌더하지 않는다.
 * @RequestBody/@RequestParam이 입력을 만들고 @Valid/제약 어노테이션이 제목·revision·페이지 범위를 검사한다.
 * Authentication을 Service로 넘겨 사용자 소유권/조회 조건/쓰기 TX를 Service 한 곳에서 적용한다.
 */
@RestController @RequestMapping("/api/notes")
public class NoteController {
    private final NoteService service;
    public NoteController(NoteService service) {this.service=service;}
    @GetMapping @Operation(operationId="listStarterNotes")
    public NoteDtos.Page list(Authentication actor,@RequestParam(defaultValue="") @Size(max=200) String q,
        @RequestParam(defaultValue="0") @Min(0) @Max(1000000) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int size) {return service.list(actor,q,page,size);}
    @GetMapping("/stats") @Operation(operationId="starterNoteStats") public NoteDtos.Stats stats(Authentication actor) {return service.stats(actor);}
    @GetMapping("/{id}") @Operation(operationId="getStarterNote") public NoteDtos.Response get(Authentication actor,@PathVariable @Min(1) long id) {return service.detail(actor,id);}
    @PostMapping @Operation(operationId="createStarterNote") public NoteDtos.Command create(Authentication actor,@Valid @RequestBody NoteDtos.Create body) {return service.create(actor,body);}
    @PutMapping("/{id}") @Operation(operationId="updateStarterNote") public NoteDtos.Command update(Authentication actor,@PathVariable @Min(1) long id,@Valid @RequestBody NoteDtos.Update body) {return service.update(actor,id,body);}
}
