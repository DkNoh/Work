package dev.scframework.reference.documents;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
@Entity @Table(name="reference_document") @Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class DocumentEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY)Long id;
 @Column(nullable=false,length=200)String title;
 @Lob @Column(nullable=false)String documentJson;
 @Column(nullable=false,updatable=false)Long authorId;
 @Version @Column(nullable=false)int revision=1;
 @Getter(AccessLevel.NONE) @Column(nullable=false)long commandSequence;
 @Column(nullable=false,updatable=false)Instant createdAt;
 @Column(nullable=false)Instant updatedAt;
 DocumentEntity(String title,String json,long author,Instant now){this.title=title;documentJson=json;authorId=author;createdAt=now;updatedAt=now;}
 void update(String title,String json,Instant now){this.title=title;documentJson=json;updatedAt=now;commandSequence++;}
}
