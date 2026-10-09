package dev.scframework.reference.documents;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 현재 작성자의 문서만 수정 시각/ID 내림차순으로 읽는 JPA 저장소다. 관리자라는 이유로 다른 사람 문서를 전체 조회하지 않는다.
 */
public interface DocumentRepository extends JpaRepository<DocumentEntity,Long>{List<DocumentEntity> findByAuthorIdOrderByUpdatedAtDescIdDesc(Long authorId);}
