package dev.scframework.reference.reports;

import java.time.Instant;

/**
 * MyBatis SQL 바인딩/결과 전용 내부 record다. 사용자 actor 조건·정렬·offset을 담고 시각은 Instant로 받는다.
 * API DTO에서는 Service가 UTC 문자열로 변환하므로 SQL 내부 타입이 프런트 계약으로 직접 노출되지 않는다.
 */

/** SQL 결과와 바인딩은 앱 내부 계약이며 API의 문자열 날짜와 분리한다. */
public final class RequirementReportRows {
    private RequirementReportRows() {}

    // 클라이언트가 actorId/admin을 직접 정하지 않는다. Service가 현재 DB actor로 채우고 검증한 정렬/검색 값만 Mapper에 전달한다.
    public record Criteria(long actorId, boolean admin, String pattern, Long menuId, String status,
            Long authorId, Long screenVersionId, long offset, int size, String sort, String direction) {}

    // JOIN/집계 결과 전용 행이다. 이 DTO를 JPA 관리 객체처럼 수정해도 DB 저장이 발생하는 구조가 아니다.
    public record ItemRow(long id, long menuId, String menuName, String title, String status, int revision,
            long authorId, String authorName, Long assignedReviewerId, String assignedReviewerName,
            Instant createdAt, Instant updatedAt, String reviewDecision, long commentCount, long historyCount,
            Instant lastCommentAt) {}

    public record StatsRow(long total, long draft, long requested, long needsInfo, long reviewing,
            long agreed, long adoLinked, long unassigned) {}
}
