package dev.scframework.reference.requirements;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class RequirementDtos {
    private RequirementDtos() {}
    @Schema(name = "RequirementInput")
    public record RequirementInput(
            @NotBlank @Size(max = 200) String title,
            @NotNull @Positive Long menuId,
            @NotBlank @Size(max = 20000) String desired,
            @NotBlank @Size(max = 10000) String reason,
            @Size(max = 10000) String referenceText,
            boolean similar,
            @Size(max = 10000) String followParts,
            @Schema(nullable = true) Long screenVersionId,
            @Valid @Schema(nullable = true) BoxInput annotation,
            @Positive @Schema(requiredMode = REQUIRED, minimum = "1") int revision) {}
    @Schema(name = "RequirementBoxInput", description = "내장 EXIF 방향을 적용한 원본 이미지 기준 0~1 좌표. 원본 bytes는 보존하며 요청당 박스 하나.")
    public record BoxInput(@Schema(requiredMode=REQUIRED,minimum="0",maximum="1") double x,
            @Schema(requiredMode=REQUIRED,minimum="0",maximum="1") double y,
            @Schema(requiredMode=REQUIRED,exclusiveMinimum=true,minimum="0",maximum="1") double width,
            @Schema(requiredMode=REQUIRED,exclusiveMinimum=true,minimum="0",maximum="1") double height) {
        public void validate() {
            if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(width) || !Double.isFinite(height)
                    || x<0 || y<0 || width<=0 || height<=0 || width>1 || height>1 || x+width>1.000000001 || y+height>1.000000001)
                throw new dev.scframework.core.ApiException(400,"INVALID_INPUT","원본 이미지 안의 유효한 박스를 지정하세요.");
        }
    }
    @Schema(name = "RequirementRevisionInput")
    public record RevisionInput(@Positive @Schema(requiredMode = REQUIRED, minimum = "1") int revision) {}
    @Schema(name = "AssigneeInput")
    public record AssigneeInput(@Positive @Schema(requiredMode = REQUIRED, minimum = "1") int revision, @Positive @Schema(nullable = true) Long reviewerId) {}
    @Schema(name = "ReviewInput")
    public record ReviewInput(
            @Positive @Schema(requiredMode = REQUIRED, minimum = "1") int revision,
            @NotNull @Pattern(regexp = "UNREVIEWED|POSSIBLE|CONDITIONAL|MORE_INFO|IMPOSSIBLE") String decision,
            @NotBlank @Size(max = 10000) String rationale,
            @NotNull @Size(max = 10000) String conditions,
            @NotNull @Size(max = 10000) String scope,
            @NotNull @Size(max = 10000) String exclusions,
            @NotNull @Size(max = 10000) String acceptance,
            @NotNull @Pattern(regexp = "UNKNOWN|SMALL|MEDIUM|LARGE") String estimate,
            boolean needsInfo) {}
    @Schema(name = "CommentInput")
    public record CommentInput(@NotBlank @Size(max = 10000) String body) {}
    @Schema(name = "RequirementSummary")
    public record RequirementSummary(
            @Schema(requiredMode = REQUIRED) long id,
            @Schema(requiredMode = REQUIRED) long menuId,
            @Schema(requiredMode = REQUIRED) String menuName,
            @Schema(requiredMode = REQUIRED) String title,
            @Schema(requiredMode = REQUIRED) String desired,
            @Schema(requiredMode = REQUIRED) String reason,
            @Schema(requiredMode = REQUIRED) String referenceText,
            @Schema(requiredMode = REQUIRED, allowableValues = {"0", "1"}) int similar,
            @Schema(requiredMode = REQUIRED) String followParts,
            @Schema(requiredMode = REQUIRED, nullable = true) Long screenVersionId,
            @Schema(requiredMode = REQUIRED, allowableValues = {"DRAFT","REQUESTED","NEEDS_INFO","REVIEWING","AGREED","ADO_LINKED"}) String status,
            @Schema(requiredMode = REQUIRED, minimum = "1") int revision,
            @Schema(requiredMode = REQUIRED) long authorId,
            @Schema(requiredMode = REQUIRED) String authorName,
            @Schema(requiredMode = REQUIRED, nullable = true) Long assignedReviewerId,
            @Schema(requiredMode = REQUIRED, nullable = true) String assignedReviewerName,
            @Schema(requiredMode = REQUIRED, format = "date-time") String createdAt,
            @Schema(requiredMode = REQUIRED, format = "date-time") String updatedAt) {}
    @Schema(name = "RequirementDetail")
    public record RequirementDetail(
            @Schema(requiredMode = REQUIRED) long id,
            @Schema(requiredMode = REQUIRED) long menuId,
            @Schema(requiredMode = REQUIRED) String menuName,
            @Schema(requiredMode = REQUIRED) String title,
            @Schema(requiredMode = REQUIRED) String desired,
            @Schema(requiredMode = REQUIRED) String reason,
            @Schema(requiredMode = REQUIRED) String referenceText,
            @Schema(requiredMode = REQUIRED, allowableValues = {"0", "1"}) int similar,
            @Schema(requiredMode = REQUIRED) String followParts,
            @Schema(requiredMode = REQUIRED, nullable = true) Long screenVersionId,
            @Schema(requiredMode = REQUIRED, allowableValues = {"DRAFT","REQUESTED","NEEDS_INFO","REVIEWING","AGREED","ADO_LINKED"}) String status,
            @Schema(requiredMode = REQUIRED, minimum = "1") int revision,
            @Schema(requiredMode = REQUIRED) long authorId,
            @Schema(requiredMode = REQUIRED) String authorName,
            @Schema(requiredMode = REQUIRED, nullable = true) Long assignedReviewerId,
            @Schema(requiredMode = REQUIRED, nullable = true) String assignedReviewerName,
            @Schema(requiredMode = REQUIRED, format = "date-time") String createdAt,
            @Schema(requiredMode = REQUIRED, format = "date-time") String updatedAt,
            @Schema(requiredMode = REQUIRED, nullable = true) AnnotationResponse annotation,
            @Schema(requiredMode = REQUIRED, nullable = true) ScreenVersionResponse screenVersion,
            @Schema(requiredMode = REQUIRED, nullable = true) ReviewResponse review,
            @Schema(requiredMode = REQUIRED) List<CommentResponse> comments,
            @Schema(requiredMode = REQUIRED) List<HistoryResponse> history,
            @Schema(requiredMode = REQUIRED) List<AttachmentResponse> attachments,
            @Schema(requiredMode = REQUIRED, nullable = true) AdoResponse ado) {}
    @Schema(name = "RequirementPage")
    public record RequirementPage(
            @Schema(requiredMode = REQUIRED) List<RequirementSummary> items,
            @Schema(requiredMode = REQUIRED) long total,
            @Schema(requiredMode = REQUIRED) int page,
            @Schema(requiredMode = REQUIRED) int size) {}
    @Schema(name = "ReviewResponse")
    public record ReviewResponse(
            @Schema(requiredMode = REQUIRED) long requirementId,
            @Schema(requiredMode = REQUIRED, allowableValues = {"UNREVIEWED","POSSIBLE","CONDITIONAL","MORE_INFO","IMPOSSIBLE"}) String decision,
            @Schema(requiredMode = REQUIRED) String rationale,
            @Schema(requiredMode = REQUIRED) String conditions,
            @Schema(requiredMode = REQUIRED) String scope,
            @Schema(requiredMode = REQUIRED) String exclusions,
            @Schema(requiredMode = REQUIRED) String acceptance,
            @Schema(requiredMode = REQUIRED, allowableValues = {"UNKNOWN","SMALL","MEDIUM","LARGE"}) String estimate,
            @Schema(requiredMode = REQUIRED) long reviewerId,
            @Schema(requiredMode = REQUIRED) String reviewerName,
            @Schema(requiredMode = REQUIRED, format = "date-time") String updatedAt) {}
    @Schema(name = "CommentResponse")
    public record CommentResponse(
            @Schema(requiredMode = REQUIRED) long id,
            @Schema(requiredMode = REQUIRED) String body,
            @Schema(requiredMode = REQUIRED) long authorId,
            @Schema(requiredMode = REQUIRED) String authorName,
            @Schema(requiredMode = REQUIRED, format = "date-time") String createdAt) {}
    @Schema(name = "HistoryResponse")
    public record HistoryResponse(
            @Schema(requiredMode = REQUIRED) long id,
            @Schema(requiredMode = REQUIRED) String action,
            @Schema(requiredMode = REQUIRED, nullable = true) String beforeJson,
            @Schema(requiredMode = REQUIRED) String afterJson,
            @Schema(requiredMode = REQUIRED) long actorId,
            @Schema(requiredMode = REQUIRED) String actorName,
            @Schema(requiredMode = REQUIRED, format = "date-time") String createdAt) {}
    // 실제 미디어 상세도 기존 JSON 자리를 유지한다.
    @Schema(name = "RequirementAnnotationResponse")
    public record AnnotationResponse(@Schema(requiredMode=REQUIRED) long id, @Schema(requiredMode=REQUIRED) long requirementId,
            @Schema(requiredMode=REQUIRED) long screenVersionId, @Schema(requiredMode=REQUIRED,minimum="1") int number,
            @Schema(requiredMode=REQUIRED,minimum="0",maximum="1") double x, @Schema(requiredMode=REQUIRED,minimum="0",maximum="1") double y,
            @Schema(requiredMode=REQUIRED,minimum="0",maximum="1") double width, @Schema(requiredMode=REQUIRED,minimum="0",maximum="1") double height) {}
    @Schema(name = "RequirementScreenVersionResponse")
    public record ScreenVersionResponse(@Schema(requiredMode=REQUIRED) long id, @Schema(requiredMode=REQUIRED) long screenId,
            @Schema(requiredMode=REQUIRED,minimum="1") int version, @Schema(requiredMode=REQUIRED) long fileId,
            @Schema(requiredMode=REQUIRED,minimum="1") int width, @Schema(requiredMode=REQUIRED,minimum="1") int height,
            @Schema(requiredMode=REQUIRED) long createdBy, @Schema(requiredMode=REQUIRED,format="date-time") String createdAt,
            @Schema(requiredMode=REQUIRED,type="integer",format="int32",allowableValues={"0","1"}) int archived, @Schema(requiredMode=REQUIRED) String createdByName) {}
    @Schema(name = "RequirementAttachmentResponse")
    public record AttachmentResponse(@Schema(requiredMode=REQUIRED) long id, @Schema(requiredMode=REQUIRED) long fileId,
            @Schema(requiredMode=REQUIRED) String originalName, @Schema(requiredMode=REQUIRED) String mime,
            @Schema(requiredMode=REQUIRED,minimum="1") long size, @Schema(requiredMode=REQUIRED,format="date-time") String createdAt) {}
    @Schema(name = "RequirementAdoResponse")
    public record AdoResponse(@Schema(requiredMode=REQUIRED) String ticket, @Schema(requiredMode=REQUIRED) String url,
            @Schema(requiredMode=REQUIRED) long linkedBy, @Schema(requiredMode=REQUIRED) String linkedByName,
            @Schema(requiredMode=REQUIRED,format="date-time") String linkedAt) {}
}
