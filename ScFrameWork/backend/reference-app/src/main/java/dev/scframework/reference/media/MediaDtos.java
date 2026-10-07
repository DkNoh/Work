package dev.scframework.reference.media;

import dev.scframework.reference.requirements.RequirementDtos.BoxInput;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class MediaDtos {
    private MediaDtos() {}
    @Schema(name="ScreenInput")
    public record ScreenInput(@NotNull @Positive Long menuId, @NotBlank @Size(max=200) String name) {}
    @Schema(name="ScreenResponse")
    public record ScreenResponse(@Schema(requiredMode=REQUIRED) long id, @Schema(requiredMode=REQUIRED) long menuId, @Schema(requiredMode=REQUIRED) String name) {}
    @Schema(name="AnnotationInput")
    public record AnnotationInput(@Positive @Schema(requiredMode=REQUIRED,minimum="1") int revision, @NotNull @Valid BoxInput box) {}
    @Schema(name="AdoInput")
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
