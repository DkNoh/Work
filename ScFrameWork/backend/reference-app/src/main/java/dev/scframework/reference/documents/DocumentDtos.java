package dev.scframework.reference.documents;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

/**
 * 문서는 제목과 documentJson으로 주고받는다. documentJson은 허용 편집기 구조의 JSON 문자열이며 HTML이 아니다.
 * 목록 Summary는 본문을 빼고 상세 Response에만 문서를 포함한다.
 */
public final class DocumentDtos {
 private DocumentDtos() {}
 // documentJson의 @NotBlank만으로 문법 안전성이 보장되지는 않는다. Service가 DocumentGrammar로 허용 구조/링크/크기를 다시 검사한다.
 @Schema(name="DocumentInput") public record DocumentInput(@NotBlank @Size(max=200) String title,@NotBlank String documentJson) {}
 @Schema(name="DocumentUpdateInput") public record DocumentUpdateInput(@NotBlank @Size(max=200) String title,@NotBlank String documentJson,@NotNull @Positive Integer revision) {}
 @Schema(name="DocumentSummary") public record DocumentSummary(@Schema(requiredMode=REQUIRED)long id,@Schema(requiredMode=REQUIRED)String title,@Schema(requiredMode=REQUIRED,minimum="1")int revision,@Schema(requiredMode=REQUIRED)long authorId,@Schema(requiredMode=REQUIRED)String authorName,@Schema(requiredMode=REQUIRED,format="date-time")String createdAt,@Schema(requiredMode=REQUIRED,format="date-time")String updatedAt) {}
 @Schema(name="DocumentResponse") public record DocumentResponse(@Schema(requiredMode=REQUIRED)long id,@Schema(requiredMode=REQUIRED)String title,@Schema(requiredMode=REQUIRED,description="ScRichTextEditor가 검증한 doc JSON 문자열이며 HTML이 아니다.")String documentJson,@Schema(requiredMode=REQUIRED,minimum="1")int revision,@Schema(requiredMode=REQUIRED)long authorId,@Schema(requiredMode=REQUIRED)String authorName,@Schema(requiredMode=REQUIRED,format="date-time")String createdAt,@Schema(requiredMode=REQUIRED,format="date-time")String updatedAt) {}
}
