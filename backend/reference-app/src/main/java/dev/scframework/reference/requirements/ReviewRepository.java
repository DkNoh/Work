package dev.scframework.reference.requirements;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 요구사항 ID로 현재 검토 한 건을 읽고 쓴다. 담당자 변경 시 삭제되는 검토도 RequirementService 트랜잭션에 참여한다.
 */
public interface ReviewRepository extends JpaRepository<ReviewEntity, Long> {}
