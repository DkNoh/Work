package dev.scframework.reference.media;

import dev.scframework.reference.requirements.RequirementDtos.BoxInput;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/**
 * 화면·박스·ADO 연결·텍스트 내보내기의 공개 DTO다. 요구사항 변경 입력은 revision을 포함하고 원본 좌표는 BoxInput 규칙을 따른다.
 */

public final class MediaDtos {
    private MediaDtos() {}
    @Schema(name="ScreenInput")
    public record ScreenInput(@NotNull @Positive Long menuId, @NotBlank @Size(max=200) String name) {}
    @Schema(name="ScreenResponse")
    public record ScreenResponse(@Schema(requiredMode=REQUIRED) long id, @Schema(requiredMode=REQUIRED) long menuId, @Schema(requiredMode=REQUIRED) String name) {}
    @Schema(name="AnnotationInput")
    // 박스는 자체 ID 버전이 아니라 부모 요구사항 revision을 기준으로 수정한다. 0~1 좌표의 유효성은 BoxInput.validate가 최종 검사한다.
    public record AnnotationInput(@Positive @Schema(requiredMode=REQUIRED,minimum="1") int revision, @NotNull @Valid BoxInput box) {}
    @Schema(name="AdoInput")
    // 티켓 ID 문법/URL 길이는 기본 검증, URL scheme/host/userinfo와 합의 상태는 RequirementService가 검사한다.
    public record AdoInput(@Positive @Schema(requiredMode=REQUIRED,minimum="1") int revision,
            @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,80}") String ticket, @NotBlank @Size(max=2000) String url) {}
    @Schema(name="VersionAnnotationResponse")
    public record VersionAnnotationResponse(@Schema(requiredMode=REQUIRED) long id,
            @Schema(requiredMode=REQUIRED) long requirementId, @Schema(requiredMode=REQUIRED) long screenVersionId,
            @Schema(requiredMode=REQUIRED) int number, @Schema(requiredMode=REQUIRED) double x,
            @Schema(requiredMode=REQUIRED) double y, @Schema(requiredMode=REQUIRED) double width,
            @Schema(requiredMode=REQUIRED) double height, @Schema(requiredMode=REQUIRED) String title,
            @Schema(requiredMode=REQUIRED) int revision, @Schema(requiredMode=REQUIRED) long authorId) {}
    @Schema(name="RequirementExport")
    public record RequirementExport(@Schema(requiredMode=REQUIRED) String text) {}
}
