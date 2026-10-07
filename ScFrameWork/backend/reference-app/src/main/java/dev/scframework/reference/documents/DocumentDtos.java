package dev.scframework.reference.documents;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
public final class DocumentDtos {
 private DocumentDtos() {}
 @Schema(name="DocumentInput") public record DocumentInput(@NotBlank @Size(max=200) String title,@NotBlank String documentJson) {}
 @Schema(name="DocumentUpdateInput") public record DocumentUpdateInput(@NotBlank @Size(max=200) String title,@NotBlank String documentJson,@NotNull @Positive Integer revision) {}
 @Schema(name="DocumentSummary") public record DocumentSummary(@Schema(requiredMode=REQUIRED)long id,@Schema(requiredMode=REQUIRED)String title,@Schema(requiredMode=REQUIRED,minimum="1")int revision,@Schema(requiredMode=REQUIRED)long authorId,@Schema(requiredMode=REQUIRED)String authorName,@Schema(requiredMode=REQUIRED,format="date-time")String createdAt,@Schema(requiredMode=REQUIRED,format="date-time")String updatedAt) {}
 @Schema(name="DocumentResponse") public record DocumentResponse(@Schema(requiredMode=REQUIRED)long id,@Schema(requiredMode=REQUIRED)String title,@Schema(requiredMode=REQUIRED,description="ScRichTextEditor가 검증한 doc JSON 문자열이며 HTML이 아니다.")String documentJson,@Schema(requiredMode=REQUIRED,minimum="1")int revision,@Schema(requiredMode=REQUIRED)long authorId,@Schema(requiredMode=REQUIRED)String authorName,@Schema(requiredMode=REQUIRED,format="date-time")String createdAt,@Schema(requiredMode=REQUIRED,format="date-time")String updatedAt) {}
}
