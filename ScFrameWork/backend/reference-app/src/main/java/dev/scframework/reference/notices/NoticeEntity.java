package dev.scframework.reference.notices;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
@Entity @Table(name="kanban_notice") @Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class NoticeEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
 @Column(nullable=false,length=200) String title;
 @Column(nullable=false,length=50000) String content;
 @Column(nullable=false,updatable=false) Long authorId;
 @Version @Column(nullable=false) int revision=1;
 @Getter(AccessLevel.NONE) @Column(nullable=false) long commandSequence;
 @Column(nullable=false,updatable=false) Instant createdAt;
 @Column(nullable=false) Instant updatedAt;
 NoticeEntity(String title,String content,long author,Instant now) {this.title=title;this.content=content;authorId=author;createdAt=now;updatedAt=now;}
 void update(String title,String content,Instant now) {this.title=title;this.content=content;updatedAt=now;commandSequence++;}
}
