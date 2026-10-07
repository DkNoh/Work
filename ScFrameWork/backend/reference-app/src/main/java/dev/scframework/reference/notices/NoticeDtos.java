package dev.scframework.reference.notices;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
public final class NoticeDtos {
 private NoticeDtos() {}
 @Schema(name="NoticeInput") public record NoticeInput(@NotBlank @Size(max=200) String title, @NotBlank @Size(max=50000) String content) {}
 @Schema(name="NoticeUpdateInput") public record NoticeUpdateInput(@NotBlank @Size(max=200) String title, @NotBlank @Size(max=50000) String content,@NotNull @Positive Integer revision) {}
 @Schema(name="NoticeResponse") public record NoticeResponse(@Schema(requiredMode=REQUIRED) long id,@Schema(requiredMode=REQUIRED) String title,@Schema(requiredMode=REQUIRED) String content,@Schema(requiredMode=REQUIRED) long authorId,@Schema(requiredMode=REQUIRED) String authorName,@Schema(requiredMode=REQUIRED) String authorUsername,@Schema(requiredMode=REQUIRED,minimum="1") int revision,@Schema(requiredMode=REQUIRED,format="date-time") String createdAt,@Schema(requiredMode=REQUIRED,format="date-time") String updatedAt) {}
}
