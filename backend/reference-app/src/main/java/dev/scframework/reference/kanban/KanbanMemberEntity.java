package dev.scframework.reference.kanban;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 행의 존재 자체가 일반 사용자의 칸반 접근 허용을 뜻한다. ADMIN의 항상 허용 정책은 AccessService에서 계산한다.
 */

@Entity @Table(name = "kanban_member") @Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
public class KanbanMemberEntity {
    @Id Long userId;
    public KanbanMemberEntity(long userId) { this.userId = userId; }
}
