package dev.scframework.reference.notices;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

/**
 // 요청 revision 비교 후에도 동시 UPDATE/DELETE가 생길 수 있다. @Version 조건이 DB의 마지막 경쟁을 감지한다.
 // flush는 SQL/버전 검사를 앞당기지만 commit은 아니므로 뒤 단계 실패 시 같은 트랜잭션의 변경도 rollback된다.
 * 공지 본문은 HTML 문서가 아닌 평문이다. 작성자/생성 시각은 바뀌지 않고 수정은 @Version과 commandSequence로 추적한다.
 */
@Entity @Table(name="kanban_notice") @Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class NoticeEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
 @Column(nullable=false,length=200) String title;
 @Column(nullable=false,length=50000) String content;
 @Column(nullable=false,updatable=false) Long authorId;
 @Version @Column(nullable=false) int revision=1;
 // 같은 값/같은 시각의 유효 수정도 dirty 상태로 만들어 revision 검사가 실행되게 하는 내부 카운터다. 공개 DTO에는 내보내지 않는다.
 @Getter(AccessLevel.NONE) @Column(nullable=false) long commandSequence;
 @Column(nullable=false,updatable=false) Instant createdAt;
 @Column(nullable=false) Instant updatedAt;
 NoticeEntity(String title,String content,long author,Instant now) {this.title=title;this.content=content;authorId=author;createdAt=now;updatedAt=now;}
 void update(String title,String content,Instant now) {this.title=title;this.content=content;updatedAt=now;commandSequence++;}
}
