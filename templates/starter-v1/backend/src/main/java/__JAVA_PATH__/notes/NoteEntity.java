package __JAVA_PACKAGE__.notes;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
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
