package dev.scframework.reference.reports;

import static dev.scframework.reference.reports.RequirementReportDtos.*;

import dev.scframework.core.ApiException;
import dev.scframework.reference.identity.UserEntity;
import java.time.Instant;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RequirementReportService {
    private static final Set<String> SORTS = Set.of("updatedAt", "title", "commentCount", "historyCount", "lastCommentAt");
    private final RequirementReportSqlMapper mapper;

    public RequirementReportService(RequirementReportSqlMapper mapper) { this.mapper = mapper; }

    // H2 REPEATABLE_READ는 phantom을 허용한다. HTTP의 독립 읽기는 통계·페이지를 한 snapshot으로 읽는다.
    // 기존 REQUIRED 트랜잭션 안에서 호출하면 외부 isolation을 승계하고 미리 flush한 JPA 자료를 함께 읽는다.
    @Transactional(readOnly = true, isolation = Isolation.SERIALIZABLE)
    public RequirementReportPage report(String q, Long menuId, String status, Long authorId, Long screenVersionId,
            int page, int size, String sort, String direction, UserEntity actor) {
        var criteria = criteria(q, menuId, status, authorId, screenVersionId, page, size, sort, direction, actor);
        var totals = mapper.selectStats(criteria);
        var items = mapper.selectPage(criteria).stream().map(row -> new RequirementReportItem(
                row.id(), row.menuId(), row.menuName(), row.title(), row.status(), row.revision(), row.authorId(),
                row.authorName(), row.assignedReviewerId(), row.assignedReviewerName(), utc(row.createdAt()),
                utc(row.updatedAt()), row.reviewDecision(), row.commentCount(), row.historyCount(), utc(row.lastCommentAt()))).toList();
        return new RequirementReportPage(items, totals.total(), page, size, new RequirementReportStats(
                totals.draft(), totals.requested(), totals.needsInfo(), totals.reviewing(), totals.agreed(),
                totals.adoLinked(), totals.unassigned()));
    }

    static RequirementReportRows.Criteria criteria(String q, Long menuId, String status, Long authorId,
            Long screenVersionId, int page, int size, String sort, String direction, UserEntity actor) {
        if (q == null || q.length() > 200 || page < 0 || page > 1_000_000 || size < 1 || size > 100)
            throw invalid("조회 범위를 확인하세요.");
        if (sort == null && direction != null) throw invalid("정렬 항목과 방향을 함께 지정하세요.");
        if (sort != null && !SORTS.contains(sort)) throw invalid("지원하는 정렬 항목을 선택하세요.");
        if (direction != null && !Set.of("asc", "desc").contains(direction)) throw invalid("정렬 방향을 확인하세요.");
        String pattern = q.isEmpty() ? null : "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return new RequirementReportRows.Criteria(actor.getId(), actor.isAdmin(), pattern, menuId, status,
                authorId, screenVersionId, (long) page * size, size, sort == null ? "updatedAt" : sort,
                direction == null ? "desc" : direction);
    }

    private static String utc(Instant value) { return value == null ? null : value.toString(); }
    private static ApiException invalid(String message) { return new ApiException(400, "INVALID_INPUT", message); }
}
