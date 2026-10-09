package dev.scframework.reference.requirements;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 요구사항 댓글을 ID 오름차순으로 반환한다. 권한 확인 후 RequirementService가 호출하며 저장소 자체가 사용자 권한을 판정하지 않는다.
 */
public interface CommentRepository extends JpaRepository<CommentEntity, Long> { List<CommentEntity> findByRequirementIdOrderByIdAsc(long requirementId); }
