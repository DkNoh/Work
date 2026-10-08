package dev.scframework.reference.requirements;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import static dev.scframework.reference.requirements.RequirementDtos.*;

/**
 * 요구사항당 하나의 검토를 requirementId PK로 저장한다. 별도 @Version 대신 부모 요구사항 명령의 revision 경쟁 검사를 사용한다.
 */

@Entity
@Table(name = "requirement_review")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ReviewEntity {
    @Id Long requirementId;
    @Column(nullable = false, length = 16) String decision;
    @Column(nullable = false, length = 10000) String rationale;
    @Column(nullable = false, length = 10000) String conditions;
    @Column(nullable = false, length = 10000) String scope;
    @Column(nullable = false, length = 10000) String exclusions;
    @Column(nullable = false, length = 10000) String acceptance;
    @Column(nullable = false, length = 16) String estimate;
    @Column(nullable = false) Long reviewerId;
    @Column(nullable = false) Instant updatedAt;
    ReviewEntity(long requirementId) { this.requirementId = requirementId; }
    // 검토 입력을 복사하는 순수 엔티티 변경이다. 담당자/자기 검토 금지/부모 revision 선행 검사는 Service가 끝낸 뒤 호출한다.
    void update(ReviewInput input, long reviewerId, Instant now) {
        decision = input.decision(); rationale = input.rationale(); conditions = input.conditions(); scope = input.scope();
        exclusions = input.exclusions(); acceptance = input.acceptance(); estimate = input.estimate();
        this.reviewerId = reviewerId; updatedAt = now;
    }
    // Oracle의 빈 문자열=NULL 저장 규칙은 읽기 getter에서만 복원한다.
    // 엔티티 필드를 @PostLoad에서 바꾸면 조회만 해도 dirty/revision 변경이 생길 수 있어 상태는 보존한다.
    // API/MapStruct는 다른 DB와 동일한 빈 문자열을 받으며 필수 본문 null은 숨기지 않는다.
    public String getConditions() { return conditions == null ? "" : conditions; }
    public String getScope() { return scope == null ? "" : scope; }
    public String getExclusions() { return exclusions == null ? "" : exclusions; }
    public String getAcceptance() { return acceptance == null ? "" : acceptance; }
}
