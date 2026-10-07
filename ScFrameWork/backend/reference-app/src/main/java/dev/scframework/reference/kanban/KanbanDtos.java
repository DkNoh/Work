package dev.scframework.reference.kanban;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public final class KanbanDtos {
    private KanbanDtos() {}
    public enum Status { TODO, IN_PROGRESS, DONE, REJECTED }
    public enum Priority { LOW, MEDIUM, HIGH }
    public enum View { ALL, CREATED, ASSIGNED }

    @Schema(name = "TaskInput")
    public record TaskInput(@NotBlank @Size(max = 200) String title, @Size(max = 10000) String description,
            @NotNull Status status, @NotNull Priority priority, @Positive @Schema(types={"integer","null"},format="int64",nullable=true) Long assigneeId,
            @Pattern(regexp = "[0-9]{4}-[0-9]{2}-[0-9]{2}") @Schema(types={"string","null"},nullable=true,format="date") String dueDate,
            @Size(max = 10) List<@NotBlank @Size(max = 30) String> tags, @Positive Integer revision, @Positive Long boardId) {}
    @Schema(name = "TaskCreateInput")
    public record TaskCreateInput(@NotBlank @Size(max = 200) String title, @Size(max = 10000) String description,
            @NotNull Status status, @NotNull Priority priority, @Positive @Schema(types={"integer","null"},format="int64",nullable=true) Long assigneeId,
            @Pattern(regexp = "[0-9]{4}-[0-9]{2}-[0-9]{2}") @Schema(types={"string","null"},nullable=true,format="date") String dueDate,
            @Size(max = 10) List<@NotBlank @Size(max = 30) String> tags) {}
    @Schema(name = "TaskMoveInput")
    public record TaskMoveInput(@NotNull Status status, @Positive @Schema(types={"integer","null"},format="int64",nullable=true) Long beforeId, @NotNull @Positive Integer revision) {}
    @Schema(name = "BoardInput") public record BoardInput(@NotBlank @Size(max = 100) String title) {}
    @Schema(name = "BoardRenameInput") public record BoardRenameInput(@NotBlank @Size(max = 100) String title, @NotNull @Positive Integer revision) {}
    @Schema(name = "KanbanMemberInput") public record KanbanMemberInput(@NotNull Boolean allowed) {}
    @Schema(name = "KanbanAccessResponse") public record KanbanAccessResponse(@Schema(requiredMode = REQUIRED) boolean allowed) {}
    @Schema(name = "KanbanUserResponse")
    public record KanbanUserResponse(@Schema(requiredMode = REQUIRED) long id, @Schema(requiredMode = REQUIRED) String username,
            @Schema(requiredMode = REQUIRED) String displayName, @Schema(requiredMode = REQUIRED) String role) {}
    @Schema(name = "KanbanMemberResponse")
    public record KanbanMemberResponse(@Schema(requiredMode = REQUIRED) long id, @Schema(requiredMode = REQUIRED) String username,
            @Schema(requiredMode = REQUIRED) String displayName, @Schema(requiredMode = REQUIRED) String role,
            @Schema(requiredMode = REQUIRED) boolean kanbanAccess) {}
    @Schema(name = "BoardResponse")
    public record BoardResponse(@Schema(requiredMode = REQUIRED) long id, @Schema(requiredMode = REQUIRED) String title,
            @Schema(requiredMode = REQUIRED, nullable = true) Long authorId,
            @Schema(requiredMode = REQUIRED, nullable = true) String authorName,
            @Schema(requiredMode = REQUIRED, nullable = true) String authorUsername,
            @Schema(requiredMode = REQUIRED, minimum = "1") int revision,
            @Schema(requiredMode = REQUIRED, format = "date-time") String createdAt,
            @Schema(requiredMode = REQUIRED, format = "date-time") String updatedAt,
            @Schema(requiredMode = REQUIRED) boolean canRename) {}
    @Schema(name = "TaskResponse")
    public record TaskResponse(@Schema(requiredMode = REQUIRED) long id, @Schema(requiredMode = REQUIRED) long boardId,
            @Schema(requiredMode = REQUIRED) String title, @Schema(requiredMode = REQUIRED) String description,
            @Schema(requiredMode = REQUIRED) Status status, @Schema(requiredMode = REQUIRED) Priority priority,
            @Schema(requiredMode = REQUIRED, nullable = true) Long assigneeId,
            @Schema(requiredMode = REQUIRED, nullable = true) String assigneeName,
            @Schema(requiredMode = REQUIRED, nullable = true) String assigneeUsername,
            @Schema(requiredMode = REQUIRED) long authorId, @Schema(requiredMode = REQUIRED) String authorName,
            @Schema(requiredMode = REQUIRED) String authorUsername,
            @Schema(requiredMode = REQUIRED, nullable = true, format = "date") String dueDate,
            @Schema(requiredMode = REQUIRED) List<String> tags, @Schema(requiredMode = REQUIRED) double position,
            @Schema(requiredMode = REQUIRED, minimum = "1") int revision,
            @Schema(requiredMode = REQUIRED, format = "date-time") String createdAt,
            @Schema(requiredMode = REQUIRED, format = "date-time") String updatedAt,
            @Schema(requiredMode = REQUIRED, nullable = true, format = "date-time") String completedAt) {}
    @Schema(name = "TaskImportRow")
    public record TaskImportRow(@NotNull @Positive Integer rowNumber, @NotNull @Valid TaskCreateInput input) {}
    @Schema(name = "TaskImportInput", description = "승인한 행만 새 작업으로 원자적으로 생성한다. 같은 성공 요청 재전송은 새 작업을 다시 만든다.")
    public record TaskImportInput(@NotNull @Positive Long boardId, @NotNull @Size(min = 1, max = 200) List<@NotNull @Valid TaskImportRow> rows) {}
    @Schema(name = "TaskImportResult")
    public record TaskImportResult(@Schema(requiredMode = REQUIRED) List<TaskResponse> items,
            @Schema(requiredMode = REQUIRED) int importedCount) {
        public TaskImportResult { items = List.copyOf(items); }
    }
}
