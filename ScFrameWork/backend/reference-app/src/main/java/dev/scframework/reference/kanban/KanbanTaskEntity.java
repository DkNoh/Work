package dev.scframework.reference.kanban;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 작업 본문·상태·담당자·태그 JSON·수동 위치와 revision을 보유하는 영속 모델이다.
 * 기한은 시간대 변환 없는 달력 날짜 문자열이며 createdAt/updatedAt/completedAt은 Instant다.
 */

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
    // 요청 revision 비교 후에도 동시 UPDATE/DELETE가 생길 수 있다. @Version 조건이 DB의 마지막 경쟁을 감지한다.
    // flush는 SQL/버전 검사를 앞당기지만 commit은 아니므로 뒤 단계 실패 시 같은 트랜잭션의 변경도 rollback된다.
    @Version @Column(nullable = false) int revision = 1;
    // 같은 값/같은 시각의 유효 수정도 dirty 상태로 만들어 revision 검사가 실행되게 하는 내부 카운터다. 공개 DTO에는 내보내지 않는다.
    @Getter(AccessLevel.NONE) @Column(nullable = false) long commandSequence;
    @Column(nullable = false, updatable = false) Instant createdAt;
    @Column(nullable = false) Instant updatedAt;
    Instant completedAt;
    KanbanTaskEntity(long boardId, long authorId, double position, Instant now) {
        this.boardId = boardId; this.authorId = authorId; this.position = position; createdAt = now; updatedAt = now;
    }
    // DONE 진입 때 완료 시각을 기록하고 다른 상태로 이동하면 비운다. 동일 상태 재저장은 기존 완료 시각을 유지한다.
    void changeStatus(KanbanDtos.Status next, Instant now) {
        if (status != next) completedAt = next == KanbanDtos.Status.DONE ? now : null;
        status = next;
    }
    void changed(Instant now) { updatedAt = now; commandSequence++; }
}
