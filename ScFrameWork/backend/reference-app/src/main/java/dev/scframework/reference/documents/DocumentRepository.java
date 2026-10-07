package dev.scframework.reference.documents;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface DocumentRepository extends JpaRepository<DocumentEntity,Long>{List<DocumentEntity> findByAuthorIdOrderByUpdatedAtDescIdDesc(Long authorId);}
