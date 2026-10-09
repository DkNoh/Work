package __JAVA_PACKAGE__.notes;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/*
 * 앱의 starter_note 테이블 한 행을 매핑하는 JPA 엔티티다. API DTO와 분리해 owner를 응답에 자동 노출하지 않는다.
 * @Version revision은 JPA UPDATE 시 동시 수정 충돌을 검출한다. 서비스의 클라이언트 revision 검사와 역할이 다르다.
 * 보호된 기본 생성자는 JPA용이며 rename은 값이 실제 달라질 때만 필드/updatedAt을 바꿔 dirty checking에 맡긴다.
 */
@Entity @Table(name="starter_note") @Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class NoteEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false,length=200) private String title;
    @Column(nullable=false,length=64) private String owner;
    @Version @Column(nullable=false) private int revision=1;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    NoteEntity(String title,String owner,Instant now) { this.title=title;this.owner=owner;this.updatedAt=now; }
    void rename(String value,Instant now) { if (!title.equals(value)) {title=value;updatedAt=now;} }
}
