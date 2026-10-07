package dev.scframework.reference.notices;
import org.springframework.data.jpa.repository.*;
public interface NoticeRepository extends JpaRepository<NoticeEntity,Long>,JpaSpecificationExecutor<NoticeEntity> {}
