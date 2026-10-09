package __JAVA_PACKAGE__.notes;
import org.springframework.data.jpa.repository.JpaRepository;

/*
 * Spring Data JPA가 구현하는 Notes의 단순 CRUD 저장소다. Long이 엔티티 식별자 타입이다.
 * findById 자체는 소유자 권한을 검사하지 않는다. Service가 조회 후 owner를 검사하고 쓰기 TX/flush를 조율한다.
 */
public interface NoteRepository extends JpaRepository<NoteEntity,Long> {}
