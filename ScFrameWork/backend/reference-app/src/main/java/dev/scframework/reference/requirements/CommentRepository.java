package dev.scframework.reference.requirements;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CommentRepository extends JpaRepository<CommentEntity, Long> { List<CommentEntity> findByRequirementIdOrderByIdAsc(long requirementId); }
