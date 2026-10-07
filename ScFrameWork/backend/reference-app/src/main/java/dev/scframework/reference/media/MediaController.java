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

@RestController @RequestMapping("/api")
public class MediaController {
    private final MediaService media;private final RequirementService requirements;private final ActorResolver actors;
    public MediaController(MediaService media,RequirementService requirements,ActorResolver actors) { this.media=media;this.requirements=requirements;this.actors=actors; }
    @GetMapping("/screens") public List<ScreenResponse> screens(Authentication authentication) { actors.require(authentication);return media.screens(); }
    @PostMapping("/screens") public ScreenResponse screen(@Valid @RequestBody ScreenInput input,Authentication authentication) { return media.createScreen(input,actors.require(authentication)); }
    @GetMapping("/screens/{id}/versions") public List<ScreenVersionResponse> versions(@PathVariable long id,Authentication authentication) { actors.require(authentication);return media.versions(id); }
    @PostMapping(value="/screens/{id}/versions",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ScreenVersionResponse version(@PathVariable long id,@RequestParam MultipartFile file,Authentication authentication) {
        UserEntity actor=actors.require(authentication);media.requireScreen(id);var prepared=media.prepare(file,true);
        try {return media.uploadVersion(id,prepared,actor);} catch (RuntimeException exception) {media.discard(prepared);throw exception;}
    }
    @PostMapping("/versions/{id}/archive") public ScreenVersionResponse archive(@PathVariable long id,Authentication authentication) { return media.archive(id,actors.require(authentication)); }
    @GetMapping("/versions/{id}/annotations") public List<VersionAnnotationResponse> annotations(@PathVariable long id,Authentication authentication) { return media.annotations(id,actors.require(authentication)); }
    @PutMapping("/requirements/{id}/annotation") public RequirementDetail annotation(@PathVariable long id,@Valid @RequestBody AnnotationInput input,Authentication authentication) { return requirements.annotation(id,input.revision(),input.box(),actors.require(authentication)); }
    @DeleteMapping("/requirements/{id}/annotation") public RequirementDetail deleteAnnotation(@PathVariable long id,@RequestParam @Positive int revision,Authentication authentication) { return requirements.annotation(id,revision,null,actors.require(authentication)); }
    @PostMapping(value="/requirements/{id}/attachments",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public RequirementDetail attachment(@PathVariable long id,@RequestParam @Positive int revision,@RequestParam MultipartFile file,Authentication authentication) {
        UserEntity actor=actors.require(authentication);requirements.checkAttachment(id,revision,actor);var prepared=media.prepare(file,false);
        try {return requirements.attachment(id,revision,prepared,actor);} catch (RuntimeException exception) {media.discard(prepared);throw exception;}
    }
    @DeleteMapping("/requirements/{id}/attachments/{attachmentId}") public RequirementDetail deleteAttachment(@PathVariable long id,@PathVariable long attachmentId,@RequestParam @Positive int revision,Authentication authentication) { return requirements.deleteAttachment(id,attachmentId,revision,actors.require(authentication)); }
    @PutMapping("/requirements/{id}/ado") public RequirementDetail ado(@PathVariable long id,@Valid @RequestBody AdoInput input,Authentication authentication) { return requirements.ado(id,input,actors.require(authentication)); }
    @GetMapping("/requirements/{id}/export") public RequirementExport export(@PathVariable long id,Authentication authentication) { return new RequirementExport(requirements.export(id,actors.require(authentication))); }
    @GetMapping("/files/{id}") public ResponseEntity<Resource> file(@PathVariable long id,Authentication authentication) {
        var file=media.readableFile(id,actors.require(authentication));boolean inline=media.isScreenFile(id);
        ContentDisposition disposition=(inline?ContentDisposition.inline():ContentDisposition.attachment()).filename(file.getOriginalName(),StandardCharsets.UTF_8).build();
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.getMime())).contentLength(file.getSize()).cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION,disposition.toString()).body(new InputStreamResource(media.open(file)));
    }
}
