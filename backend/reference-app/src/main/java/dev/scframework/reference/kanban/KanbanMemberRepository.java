package dev.scframework.reference.kanban;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 사용자 ID와 같은 PK로 칸반 허용 멤버의 존재/추가/삭제를 제공한다. 멤버 변경 권한은 AccessService에서 검사한다.
 */
public interface KanbanMemberRepository extends JpaRepository<KanbanMemberEntity, Long> {}
