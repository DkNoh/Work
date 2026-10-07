package dev.scframework.reference.kanban;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity @Table(name = "kanban_board") @Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
public class KanbanBoardEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false, length = 100) String title;
    @Column(updatable = false) Long authorId;
    @Version @Column(nullable = false) int revision = 1;
    @Getter(AccessLevel.NONE) @Column(nullable = false) long commandSequence;
    @Column(nullable = false, updatable = false) Instant createdAt;
    @Column(nullable = false) Instant updatedAt;
    KanbanBoardEntity(String title, long authorId, Instant now) { this.title = title; this.authorId = authorId; createdAt = now; updatedAt = now; }
    void rename(String title, Instant now) { this.title = title; updatedAt = now; commandSequence++; }
}
