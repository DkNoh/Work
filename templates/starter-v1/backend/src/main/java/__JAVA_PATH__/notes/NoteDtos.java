package __JAVA_PACKAGE__.notes;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
public final class NoteDtos {
    private NoteDtos() {}
    @Schema(name="StarterNoteCreateInput")
    public record Create(@Schema(requiredMode=Schema.RequiredMode.REQUIRED,maxLength=200) @NotBlank @Size(max=200) String title) {}
    @Schema(name="StarterNoteUpdateInput")
    public record Update(@Schema(requiredMode=Schema.RequiredMode.REQUIRED,maxLength=200) @NotBlank @Size(max=200) String title,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1") @NotNull @Min(1) Integer revision) {}
    @Schema(name="StarterNoteResponse")
    public record Response(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) Long id,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String title,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1") int revision,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,type="string",format="date-time") Instant updatedAt) {}
    @Schema(name="StarterNotePage")
    public record Page(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<Response> items,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0") long total,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0") int page,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1") int size) {}
    @Schema(name="StarterNoteStats")
    public record Stats(@Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0") long total,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0") int highestRevision) {}
    @Schema(name="StarterNoteCommand")
    public record Command(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) Response item,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Stats stats) {}
}
