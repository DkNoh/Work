package dev.scframework.reference.requirements;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import static dev.scframework.reference.requirements.RequirementDtos.*;

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
    @Version @Column(nullable = false) int revision = 1;
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
