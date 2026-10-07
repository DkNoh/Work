package dev.scframework.reference.kanban;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface KanbanBoardRepository extends JpaRepository<KanbanBoardEntity, Long> {
    List<KanbanBoardEntity> findAllByOrderByIdAsc();
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select b from KanbanBoardEntity b where b.id=:id")
    Optional<KanbanBoardEntity> lockById(@Param("id") long id);
}
