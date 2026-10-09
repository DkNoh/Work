package dev.scframework.reference.reports;

import static dev.scframework.reference.reports.RequirementReportDtos.*;

import dev.scframework.core.ApiException;
import dev.scframework.reference.identity.UserEntity;
import java.time.Instant;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 허용 조회/정렬 조건을 검증해 MyBatis에 전달하고 SQL 결과를 공개 보고서 DTO로 변환한다.
 * 두 조회의 스냅샷 일관성을 위해 독립 요청은 SERIALIZABLE 읽기 트랜잭션으로 수행한다.
 */

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
        // 통계와 목록 두 SQL을 같은 읽기 스냅샷에서 실행한다. 단순히 화면에 보이는 페이지 행만 합산한 수치가 아니다.
        var totals = mapper.selectStats(criteria);
        var items = mapper.selectPage(criteria).stream().map(row -> new RequirementReportItem(
                row.id(), row.menuId(), row.menuName(), row.title(), row.status(), row.revision(), row.authorId(),
                row.authorName(), row.assignedReviewerId(), row.assignedReviewerName(), utc(row.createdAt()),
                utc(row.updatedAt()), row.reviewDecision(), row.commentCount(), row.historyCount(), utc(row.lastCommentAt()))).toList();
        return new RequirementReportPage(items, totals.total(), page, size, new RequirementReportStats(
                totals.draft(), totals.requested(), totals.needsInfo(), totals.reviewing(), totals.agreed(),
                totals.adoLinked(), totals.unassigned()));
    }

    // 페이지/크기/정렬 조합을 검증한다. direction만 주는 요청은 모호하므로 400이며 기본 정렬은 updatedAt DESC다.
    static RequirementReportRows.Criteria criteria(String q, Long menuId, String status, Long authorId,
            Long screenVersionId, int page, int size, String sort, String direction, UserEntity actor) {
        if (q == null || q.length() > 200 || page < 0 || page > 1_000_000 || size < 1 || size > 100)
            throw invalid("조회 범위를 확인하세요.");
        if (sort == null && direction != null) throw invalid("정렬 항목과 방향을 함께 지정하세요.");
        if (sort != null && !SORTS.contains(sort)) throw invalid("지원하는 정렬 항목을 선택하세요.");
        if (direction != null && !Set.of("asc", "desc").contains(direction)) throw invalid("정렬 방향을 확인하세요.");
        // LIKE용 %, _, 역슬래시를 escape해 검색어를 literal 부분 문자열로 다룬다. 앞뒤 공백은 별도 strip하지 않는다.
        String pattern = q.isEmpty() ? null : "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return new RequirementReportRows.Criteria(actor.getId(), actor.isAdmin(), pattern, menuId, status,
                authorId, screenVersionId, (long) page * size, size, sort == null ? "updatedAt" : sort,
                direction == null ? "desc" : direction);
    }

    // SQL Instant를 API UTC 문자열로 변환한다. null 마지막 댓글 시각은 null로 보존한다.
    private static String utc(Instant value) { return value == null ? null : value.toString(); }
    private static ApiException invalid(String message) { return new ApiException(400, "INVALID_INPUT", message); }
}
