package dev.scframework.reference.requirements;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface HistoryRepository extends JpaRepository<HistoryEntity, Long> { List<HistoryEntity> findByRequirementIdOrderByIdDesc(long requirementId); }
