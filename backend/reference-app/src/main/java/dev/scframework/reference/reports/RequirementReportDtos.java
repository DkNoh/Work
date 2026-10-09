package dev.scframework.reference.reports;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 본문/이력 JSON을 제외한 보고서 응답이다. 현재 페이지 items와 전체 조건의 total/stats를 한 응답으로 전달한다.
 */

/** 보고서는 업무 입력이나 이력 본문을 복제하지 않는 조회 전용 계약이다. */
public final class RequirementReportDtos {
    private RequirementReportDtos() {}

    @Schema(name = "RequirementReportItem")
    public record RequirementReportItem(
            @Schema(requiredMode = REQUIRED) long id,
            @Schema(requiredMode = REQUIRED) long menuId,
            @Schema(requiredMode = REQUIRED) String menuName,
            @Schema(requiredMode = REQUIRED) String title,
            @Schema(requiredMode = REQUIRED, allowableValues = {"DRAFT", "REQUESTED", "NEEDS_INFO", "REVIEWING", "AGREED", "ADO_LINKED"}) String status,
            @Schema(requiredMode = REQUIRED, minimum = "1") int revision,
            @Schema(requiredMode = REQUIRED) long authorId,
            @Schema(requiredMode = REQUIRED) String authorName,
            @Schema(requiredMode = REQUIRED, nullable = true) Long assignedReviewerId,
            @Schema(requiredMode = REQUIRED, nullable = true) String assignedReviewerName,
            @Schema(requiredMode = REQUIRED, format = "date-time") String createdAt,
            @Schema(requiredMode = REQUIRED, format = "date-time") String updatedAt,
            @Schema(requiredMode = REQUIRED, nullable = true, allowableValues = {"UNREVIEWED", "POSSIBLE", "CONDITIONAL", "MORE_INFO", "IMPOSSIBLE"}) String reviewDecision,
            @Schema(requiredMode = REQUIRED, minimum = "0") long commentCount,
            @Schema(requiredMode = REQUIRED, minimum = "0") long historyCount,
            @Schema(requiredMode = REQUIRED, nullable = true, format = "date-time") String lastCommentAt) {}

    @Schema(name = "RequirementReportStats", description = "필터와 읽기 권한을 적용한 전체 결과의 상태 건수와 미지정 건수")
    // 통계는 페이지 items만 세는 값이 아니라 동일 필터/읽기 권한의 전체 결과다. JSON 키는 기존 상태 코드 대문자를 보존한다.
    public record RequirementReportStats(
            @JsonProperty("DRAFT") @Schema(name = "DRAFT", requiredMode = REQUIRED, minimum = "0") long draft,
            @JsonProperty("REQUESTED") @Schema(name = "REQUESTED", requiredMode = REQUIRED, minimum = "0") long requested,
            @JsonProperty("NEEDS_INFO") @Schema(name = "NEEDS_INFO", requiredMode = REQUIRED, minimum = "0") long needsInfo,
            @JsonProperty("REVIEWING") @Schema(name = "REVIEWING", requiredMode = REQUIRED, minimum = "0") long reviewing,
            @JsonProperty("AGREED") @Schema(name = "AGREED", requiredMode = REQUIRED, minimum = "0") long agreed,
            @JsonProperty("ADO_LINKED") @Schema(name = "ADO_LINKED", requiredMode = REQUIRED, minimum = "0") long adoLinked,
            @Schema(requiredMode = REQUIRED, minimum = "0") long unassigned) {}

    @Schema(name = "RequirementReportPage")
    // items를 방어 복사해 반환한다. 성공 응답에 추가 success/data 래퍼를 넣지 않아 Vue 표/차트가 이 계약을 그대로 소비한다.
    public record RequirementReportPage(
            @Schema(requiredMode = REQUIRED) List<RequirementReportItem> items,
            @Schema(requiredMode = REQUIRED, minimum = "0") long total,
            @Schema(requiredMode = REQUIRED, minimum = "0", maximum = "1000000") int page,
            @Schema(requiredMode = REQUIRED, minimum = "1", maximum = "100") int size,
            @Schema(requiredMode = REQUIRED) RequirementReportStats stats) {
        public RequirementReportPage { items = List.copyOf(items); }
    }
}
