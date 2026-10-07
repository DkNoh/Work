package dev.scframework.reference.requirements;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import static dev.scframework.reference.requirements.RequirementDtos.*;

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
    void update(ReviewInput input, long reviewerId, Instant now) {
        decision = input.decision(); rationale = input.rationale(); conditions = input.conditions(); scope = input.scope();
        exclusions = input.exclusions(); acceptance = input.acceptance(); estimate = input.estimate();
        this.reviewerId = reviewerId; updatedAt = now;
    }
}
