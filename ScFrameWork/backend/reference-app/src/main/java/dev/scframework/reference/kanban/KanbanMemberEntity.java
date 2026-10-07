package dev.scframework.reference.kanban;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity @Table(name = "kanban_member") @Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
public class KanbanMemberEntity {
    @Id Long userId;
    public KanbanMemberEntity(long userId) { this.userId = userId; }
}
