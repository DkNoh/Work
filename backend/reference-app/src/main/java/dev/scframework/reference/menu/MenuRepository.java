package dev.scframework.reference.menu;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * sortOrder 오름차순 후 ID 순서로 안정적인 메뉴 선택지를 제공하는 JPA 저장소다.
 */

public interface MenuRepository extends JpaRepository<MenuEntity, Long> {
    List<MenuEntity> findAllByOrderBySortOrderAscIdAsc();
}
