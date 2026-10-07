package dev.scframework.reference.requirements;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity @Table(name = "requirement_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class HistoryEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false) Long requirementId;
    @Column(nullable = false, length = 32) String action;
    @Lob String beforeJson;
    @Lob @Column(nullable = false) String afterJson;
    @Column(nullable = false) Long actorId;
    @Column(nullable = false) Instant createdAt;
    HistoryEntity(long requirementId, String action, String beforeJson, String afterJson, long actorId, Instant now) {
        this.requirementId = requirementId; this.action = action; this.beforeJson = beforeJson; this.afterJson = afterJson; this.actorId = actorId; createdAt = now;
    }
}
