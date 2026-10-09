package dev.scframework.reference.media;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 화면 메타데이터의 JPA 저장소다. 목록은 ID 순서이며 파일 바이트는 별도 FileStorage에 있다.
 */

public interface ScreenRepository extends JpaRepository<ScreenEntity,Long> {
    java.util.List<ScreenEntity> findAllByOrderByIdAsc();
}

