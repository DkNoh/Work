package dev.scframework.reference.media;

import dev.scframework.reference.identity.*;
import dev.scframework.reference.requirements.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import static dev.scframework.reference.media.MediaDtos.*;
import static dev.scframework.reference.requirements.RequirementDtos.*;

/**
 * 파일 HTTP와 화면/요구사항 명령을 연결한다. 원본 파일 준비는 DB 트랜잭션 밖, 메타데이터/업무 변경은 Service 트랜잭션 안에서 수행한다.
 * 다운로드는 파일 ID로 현재 읽기 권한을 검사하며 저장소 내부 key/path를 API 경로로 노출하지 않는다.
 */

@RestController @RequestMapping("/api")
public class MediaController {
    private final MediaService media;private final RequirementService requirements;private final ActorResolver actors;
    public MediaController(MediaService media,RequirementService requirements,ActorResolver actors) { this.media=media;this.requirements=requirements;this.actors=actors; }
    @GetMapping("/screens") public List<ScreenResponse> screens(Authentication authentication) { actors.require(authentication);return media.screens(); }
    @PostMapping("/screens") public ScreenResponse screen(@Valid @RequestBody ScreenInput input,Authentication authentication) { return media.createScreen(input,actors.require(authentication)); }
    @GetMapping("/screens/{id}/versions") public List<ScreenVersionResponse> versions(@PathVariable long id,Authentication authentication) { actors.require(authentication);return media.versions(id); }
    @PostMapping(value="/screens/{id}/versions",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    // 인증/화면 존재 확인 뒤 DB 트랜잭션 밖에서 blob을 준비한다. Service 진입/commit 실패도 catch에서 새 blob 정리를 요청한다.
    public ScreenVersionResponse version(@PathVariable long id,@RequestParam MultipartFile file,Authentication authentication) {
        UserEntity actor=actors.require(authentication);media.requireScreen(id);var prepared=media.prepare(file,true);
        try {return media.uploadVersion(id,prepared,actor);} catch (RuntimeException exception) {media.discard(prepared);throw exception;}
    }
    @PostMapping("/versions/{id}/archive") public ScreenVersionResponse archive(@PathVariable long id,Authentication authentication) { return media.archive(id,actors.require(authentication)); }
    @GetMapping("/versions/{id}/annotations") public List<VersionAnnotationResponse> annotations(@PathVariable long id,Authentication authentication) { return media.annotations(id,actors.require(authentication)); }
    @PutMapping("/requirements/{id}/annotation") public RequirementDetail annotation(@PathVariable long id,@Valid @RequestBody AnnotationInput input,Authentication authentication) { return requirements.annotation(id,input.revision(),input.box(),actors.require(authentication)); }
    @DeleteMapping("/requirements/{id}/annotation") public RequirementDetail deleteAnnotation(@PathVariable long id,@RequestParam @Positive int revision,Authentication authentication) { return requirements.annotation(id,revision,null,actors.require(authentication)); }
    @PostMapping(value="/requirements/{id}/attachments",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    // 비용이 큰 업로드 전에 권한/revision을 빠르게 확인한다. 준비 중 경쟁을 고려해 실제 저장 Service가 동일 조건을 다시 검사한다.
    public RequirementDetail attachment(@PathVariable long id,@RequestParam @Positive int revision,@RequestParam MultipartFile file,Authentication authentication) {
        UserEntity actor=actors.require(authentication);requirements.checkAttachment(id,revision,actor);var prepared=media.prepare(file,false);
        try {return requirements.attachment(id,revision,prepared,actor);} catch (RuntimeException exception) {media.discard(prepared);throw exception;}
    }
    @DeleteMapping("/requirements/{id}/attachments/{attachmentId}") public RequirementDetail deleteAttachment(@PathVariable long id,@PathVariable long attachmentId,@RequestParam @Positive int revision,Authentication authentication) { return requirements.deleteAttachment(id,attachmentId,revision,actors.require(authentication)); }
    @PutMapping("/requirements/{id}/ado") public RequirementDetail ado(@PathVariable long id,@Valid @RequestBody AdoInput input,Authentication authentication) { return requirements.ado(id,input,actors.require(authentication)); }
    @GetMapping("/requirements/{id}/export") public RequirementExport export(@PathVariable long id,Authentication authentication) { return new RequirementExport(requirements.export(id,actors.require(authentication))); }
    // 현재 actor의 파일 읽기 권한을 먼저 확인한다. 화면 이미지는 inline, 첨부는 attachment이며 no-store로 인증 자료의 캐시 잔류를 줄인다.
    @GetMapping("/files/{id}") public ResponseEntity<Resource> file(@PathVariable long id,Authentication authentication) {
        var file=media.readableFile(id,actors.require(authentication));boolean inline=media.isScreenFile(id);
        ContentDisposition disposition=(inline?ContentDisposition.inline():ContentDisposition.attachment()).filename(file.getOriginalName(),StandardCharsets.UTF_8).build();
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.getMime())).contentLength(file.getSize()).cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION,disposition.toString()).body(new InputStreamResource(media.open(file)));
    }
}
