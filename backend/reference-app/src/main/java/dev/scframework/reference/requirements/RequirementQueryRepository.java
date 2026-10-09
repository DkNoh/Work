package dev.scframework.reference.requirements;

import com.querydsl.core.BooleanBuilder;
import com.querydsl.jpa.impl.JPAQueryFactory;
import dev.scframework.reference.identity.UserEntity;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Repository;

/**
 * 일반 요구사항 목록의 Querydsl 조건 조립을 담당한다. 권한 predicate를 검색 조건과 함께 count/list에 동일하게 적용한다.
 */

/** Entity 기반 동적 목록만 담당한다. 단건 조회와 변경은 기존 JPA Repository를 사용한다. */
@Repository
public class RequirementQueryRepository {
    private final JPAQueryFactory queries;

    public RequirementQueryRepository(JPAQueryFactory queries) { this.queries = queries; }

    // 관리자 외 사용자는 공개 상태 또는 본인 DRAFT만 볼 수 있다. 검색 결과 건수에서도 비공개 초안이 새어나가지 않도록 같은 조건을 쓴다.
    public SearchPage search(String q, Long menuId, String status, Long authorId,
            Long screenVersionId, int page, int size, UserEntity actor) {
        QRequirementEntity request = QRequirementEntity.requirementEntity;
        BooleanBuilder visible = new BooleanBuilder();
        if (!actor.isAdmin()) visible.and(request.status.ne("DRAFT").or(request.authorId.eq(actor.getId())));
        if (!q.isEmpty()) {
            // 사용자가 입력한 %, _, 역슬래시를 LIKE 와일드카드로 해석하지 않는다.
            String literal = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
            visible.and(request.title.like("%" + literal + "%", '\\'));
        }
        if (menuId != null) visible.and(request.menuId.eq(menuId));
        if (authorId != null) visible.and(request.authorId.eq(authorId));
        if (screenVersionId != null) visible.and(request.screenVersionId.eq(screenVersionId));
        if (!status.isEmpty()) visible.and(request.status.eq(status));

        // count와 목록에 같은 공개 범위/검색 조건을 전달하고 count에는 정렬·페이지를 넣지 않는다.
        long total = Objects.requireNonNull(queries.select(request.count()).from(request).where(visible).fetchOne());
        // 동일 updatedAt의 행도 id DESC로 안정적인 순서를 만든다. offset 계산은 long으로 올려 page*size 정수 오버플로를 피한다.
        List<RequirementEntity> items = queries.selectFrom(request).where(visible)
                .orderBy(request.updatedAt.desc(), request.id.desc())
                .offset((long) page * size).limit(size).fetch();
        return new SearchPage(items, total);
    }

    // 응답 목록을 List.copyOf로 방어 복사해 조회 결과를 바깥에서 재정렬/추가하지 않게 한다.
    public record SearchPage(List<RequirementEntity> items, long total) {
        public SearchPage { items = List.copyOf(items); }
    }
}
