package dev.scframework.reference.reports;

import java.time.Instant;

/** SQL 결과와 바인딩은 앱 내부 계약이며 API의 문자열 날짜와 분리한다. */
public final class RequirementReportRows {
    private RequirementReportRows() {}

    public record Criteria(long actorId, boolean admin, String pattern, Long menuId, String status,
            Long authorId, Long screenVersionId, long offset, int size, String sort, String direction) {}

    public record ItemRow(long id, long menuId, String menuName, String title, String status, int revision,
            long authorId, String authorName, Long assignedReviewerId, String assignedReviewerName,
            Instant createdAt, Instant updatedAt, String reviewDecision, long commentCount, long historyCount,
            Instant lastCommentAt) {}

    public record StatsRow(long total, long draft, long requested, long needsInfo, long reviewing,
            long agreed, long adoLinked, long unassigned) {}
}
