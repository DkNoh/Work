package dev.scframework.reference.requirements;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 댓글은 별도 추가 기록이다. 댓글 저장은 요구사항 본문 revision/updatedAt를 바꾸지 않는 계약이다.
 */

@Entity @Table(name = "requirement_comment")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CommentEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false) Long requirementId;
    @Column(nullable = false, length = 10000) String body;
    @Column(nullable = false) Long authorId;
    @Column(nullable = false) Instant createdAt;
    CommentEntity(long requirementId, String body, long authorId, Instant now) { this.requirementId = requirementId; this.body = body; this.authorId = authorId; createdAt = now; }
}
