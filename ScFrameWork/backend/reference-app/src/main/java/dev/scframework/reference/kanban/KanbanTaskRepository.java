package dev.scframework.reference.kanban;
import java.util.List;
import org.springframework.data.jpa.repository.*;

/**
 * 조건 검색은 Specification, 수동 이동의 기준 열 조회는 board/status와 position/id 순서를 사용한다.
 * 순서 계산/잠금/권한 자체는 저장소 밖의 KanbanService가 책임진다.
 */
public interface KanbanTaskRepository extends JpaRepository<KanbanTaskEntity, Long>, JpaSpecificationExecutor<KanbanTaskEntity> {
    List<KanbanTaskEntity> findByBoardIdAndStatusOrderByPositionAscIdAsc(long boardId, KanbanDtos.Status status);
}
