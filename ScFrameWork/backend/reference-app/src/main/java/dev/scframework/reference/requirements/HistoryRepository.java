package dev.scframework.reference.requirements;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 요구사항의 업무 변경 이력을 최신 ID부터 조회한다. 생성은 Service의 실제 변경 트랜잭션에 포함된다.
 */
public interface HistoryRepository extends JpaRepository<HistoryEntity, Long> { List<HistoryEntity> findByRequirementIdOrderByIdDesc(long requirementId); }
