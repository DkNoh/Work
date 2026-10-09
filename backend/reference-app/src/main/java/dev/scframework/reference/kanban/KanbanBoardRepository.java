package dev.scframework.reference.kanban;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

/**
 * 보드 목록과 동일 보드 쓰기 직렬화를 위한 PESSIMISTIC_WRITE 조회를 제공한다.
 * 잠금은 호출 트랜잭션이 끝날 때 해제되며 카드 순서 계산과 저장을 하나의 경계로 보호한다.
 */
public interface KanbanBoardRepository extends JpaRepository<KanbanBoardEntity, Long> {
    List<KanbanBoardEntity> findAllByOrderByIdAsc();
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select b from KanbanBoardEntity b where b.id=:id")
    Optional<KanbanBoardEntity> lockById(@Param("id") long id);
}
