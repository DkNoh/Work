package dev.scframework.reference.kanban;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity @Table(name = "kanban_task") @Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
public class KanbanTaskEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false, updatable = false) Long boardId;
    @Column(nullable = false, length = 200) String title;
    @Column(nullable = false, length = 10000) String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) KanbanDtos.Status status;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 6) KanbanDtos.Priority priority;
    Long assigneeId;
    @Column(nullable = false, updatable = false) Long authorId;
    @Column(length = 10) String dueDate;
    @Column(nullable = false, length = 2000) String tagsJson;
    @Column(nullable = false) double position;
    @Version @Column(nullable = false) int revision = 1;
    @Getter(AccessLevel.NONE) @Column(nullable = false) long commandSequence;
    @Column(nullable = false, updatable = false) Instant createdAt;
    @Column(nullable = false) Instant updatedAt;
    Instant completedAt;
    KanbanTaskEntity(long boardId, long authorId, double position, Instant now) {
        this.boardId = boardId; this.authorId = authorId; this.position = position; createdAt = now; updatedAt = now;
    }
    void changeStatus(KanbanDtos.Status next, Instant now) {
        if (status != next) completedAt = next == KanbanDtos.Status.DONE ? now : null;
        status = next;
    }
    void changed(Instant now) { updatedAt = now; commandSequence++; }
}
