package dev.scframework.reference.requirements;

import com.querydsl.core.BooleanBuilder;
import com.querydsl.jpa.impl.JPAQueryFactory;
import dev.scframework.reference.identity.UserEntity;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Repository;

/** Entity 기반 동적 목록만 담당한다. 단건 조회와 변경은 기존 JPA Repository를 사용한다. */
@Repository
public class RequirementQueryRepository {
    private final JPAQueryFactory queries;

    public RequirementQueryRepository(JPAQueryFactory queries) { this.queries = queries; }

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
        List<RequirementEntity> items = queries.selectFrom(request).where(visible)
                .orderBy(request.updatedAt.desc(), request.id.desc())
                .offset((long) page * size).limit(size).fetch();
        return new SearchPage(items, total);
    }

    public record SearchPage(List<RequirementEntity> items, long total) {
        public SearchPage { items = List.copyOf(items); }
    }
}
