package dev.scframework.reference.requirements;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import static dev.scframework.reference.requirements.RequirementDtos.*;

/**
 * 요구사항의 본문·상태·작성자/담당자와 optimistic revision을 보유한다.
 * 세부 권한과 상태 전이 판단은 Service가 소유하며 edit는 본문 필드만, changed는 명령 변화 표시를 담당한다.
 */

@Entity
@Table(name = "requirement_entry")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RequirementEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false) Long menuId;
    @Column(nullable = false, length = 200) String title;
    @Column(nullable = false, length = 20000) String desired;
    @Column(nullable = false, length = 10000) String reason;
    @Column(nullable = false, length = 10000) String referenceText;
    @Column(nullable = false) int similar;
    @Column(nullable = false, length = 10000) String followParts;
    Long screenVersionId;
    @Column(nullable = false, length = 16) String status = "DRAFT";
    // 요청 revision 비교 후에도 동시 UPDATE/DELETE가 생길 수 있다. @Version 조건이 DB의 마지막 경쟁을 감지한다.
    // flush는 SQL/버전 검사를 앞당기지만 commit은 아니므로 뒤 단계 실패 시 같은 트랜잭션의 변경도 rollback된다.
    @Version @Column(nullable = false) int revision = 1;
    // 같은 값/같은 시각의 유효 수정도 dirty 상태로 만들어 revision 검사가 실행되게 하는 내부 카운터다. 공개 DTO에는 내보내지 않는다.
    @Getter(AccessLevel.NONE) @Column(nullable = false) long commandSequence;
    @Column(nullable = false) Long authorId;
    Long assignedReviewerId;
    @Column(nullable = false) Instant createdAt;
    @Column(nullable = false) Instant updatedAt;
    RequirementEntity(RequirementInput input, long authorId, Instant now) { edit(input); screenVersionId=input.screenVersionId(); this.authorId = authorId; createdAt = now; updatedAt = now; }
    void edit(RequirementInput input) {
        menuId = input.menuId(); title = input.title(); desired = input.desired(); reason = input.reason();
        referenceText = Objects.toString(input.referenceText(), ""); similar = input.similar() ? 1 : 0;
        followParts = Objects.toString(input.followParts(), "");
    }
    /** 같은 시각/같은 값의 유효 명령도 dirty 상태로 만들어 @Version이 정확히 한 번 증가하게 한다. */
    void changed(String status, Instant now) { this.status = status; updatedAt = now; commandSequence++; }
}
