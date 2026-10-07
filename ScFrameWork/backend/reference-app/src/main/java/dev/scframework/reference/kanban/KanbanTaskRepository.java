package dev.scframework.reference.kanban;
import java.util.List;
import org.springframework.data.jpa.repository.*;
public interface KanbanTaskRepository extends JpaRepository<KanbanTaskEntity, Long>, JpaSpecificationExecutor<KanbanTaskEntity> {
    List<KanbanTaskEntity> findByBoardIdAndStatusOrderByPositionAscIdAsc(long boardId, KanbanDtos.Status status);
}
