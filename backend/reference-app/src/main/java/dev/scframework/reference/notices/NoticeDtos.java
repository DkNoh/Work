package dev.scframework.reference.notices;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

/**
 * 평문 공지 제목/본문과 작성자·revision 응답을 정의한다. 수정은 반드시 양의 기준 revision을 받아야 한다.
 */
public final class NoticeDtos {
 private NoticeDtos() {}
 @Schema(name="NoticeInput") public record NoticeInput(@NotBlank @Size(max=200) String title, @NotBlank @Size(max=50000) String content) {}
 // 등록과 달리 수정은 사용자가 편집을 시작한 revision이 필수다. content는 평문이며 rich text/HTML 문법을 받지 않는다.
 @Schema(name="NoticeUpdateInput") public record NoticeUpdateInput(@NotBlank @Size(max=200) String title, @NotBlank @Size(max=50000) String content,@NotNull @Positive Integer revision) {}
 @Schema(name="NoticeResponse") public record NoticeResponse(@Schema(requiredMode=REQUIRED) long id,@Schema(requiredMode=REQUIRED) String title,@Schema(requiredMode=REQUIRED) String content,@Schema(requiredMode=REQUIRED) long authorId,@Schema(requiredMode=REQUIRED) String authorName,@Schema(requiredMode=REQUIRED) String authorUsername,@Schema(requiredMode=REQUIRED,minimum="1") int revision,@Schema(requiredMode=REQUIRED,format="date-time") String createdAt,@Schema(requiredMode=REQUIRED,format="date-time") String updatedAt) {}
}
