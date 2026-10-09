package dev.scframework.reference.documents;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

/**
 * 개인 문서의 검증된 JSON과 작성자/revision을 저장한다. API는 이 Entity가 아닌 Summary/Response로 공개한다.
 */
@Entity @Table(name="reference_document") @Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class DocumentEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY)Long id;
 @Column(nullable=false,length=200)String title;
 @Lob @Column(nullable=false)String documentJson;
 @Column(nullable=false,updatable=false)Long authorId;
 // 요청 revision 비교 후에도 동시 UPDATE/DELETE가 생길 수 있다. @Version 조건이 DB의 마지막 경쟁을 감지한다.
 // flush는 SQL/버전 검사를 앞당기지만 commit은 아니므로 뒤 단계 실패 시 같은 트랜잭션의 변경도 rollback된다.
 @Version @Column(nullable=false)int revision=1;
 // 같은 값/같은 시각의 유효 수정도 dirty 상태로 만들어 revision 검사가 실행되게 하는 내부 카운터다. 공개 DTO에는 내보내지 않는다.
 @Getter(AccessLevel.NONE) @Column(nullable=false)long commandSequence;
 @Column(nullable=false,updatable=false)Instant createdAt;
 @Column(nullable=false)Instant updatedAt;
 DocumentEntity(String title,String json,long author,Instant now){this.title=title;documentJson=json;authorId=author;createdAt=now;updatedAt=now;}
 void update(String title,String json,Instant now){this.title=title;documentJson=json;updatedAt=now;commandSequence++;}
}
