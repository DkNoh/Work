package dev.scframework.reference.notices;
import org.springframework.data.jpa.repository.*;

/**
 * 공지의 기본 JPA CRUD와 제목/본문 검색용 Specification 조회를 제공한다. 공개 범위와 작성자 권한은 Service에서 선행 검사한다.
 */
public interface NoticeRepository extends JpaRepository<NoticeEntity,Long>,JpaSpecificationExecutor<NoticeEntity> {}
