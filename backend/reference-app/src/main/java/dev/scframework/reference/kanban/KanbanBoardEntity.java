package dev.scframework.reference.kanban;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 보드 이름/작성자/revision과 생성 시각을 저장한다. 기본 보드의 authorId=null 정책은 Service에서 별도로 판단한다.
 */

@Entity @Table(name = "kanban_board") @Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
public class KanbanBoardEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false, length = 100) String title;
    @Column(updatable = false) Long authorId;
    // 요청 revision 비교 후에도 동시 UPDATE/DELETE가 생길 수 있다. @Version 조건이 DB의 마지막 경쟁을 감지한다.
    // flush는 SQL/버전 검사를 앞당기지만 commit은 아니므로 뒤 단계 실패 시 같은 트랜잭션의 변경도 rollback된다.
    @Version @Column(nullable = false) int revision = 1;
    // 같은 값/같은 시각의 유효 수정도 dirty 상태로 만들어 revision 검사가 실행되게 하는 내부 카운터다. 공개 DTO에는 내보내지 않는다.
    @Getter(AccessLevel.NONE) @Column(nullable = false) long commandSequence;
    @Column(nullable = false, updatable = false) Instant createdAt;
    @Column(nullable = false) Instant updatedAt;
    KanbanBoardEntity(String title, long authorId, Instant now) { this.title = title; this.authorId = authorId; createdAt = now; updatedAt = now; }
    void rename(String title, Instant now) { this.title = title; updatedAt = now; commandSequence++; }
}
