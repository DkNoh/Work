package dev.scframework.reference.media;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScreenRepository extends JpaRepository<ScreenEntity,Long> {
    java.util.List<ScreenEntity> findAllByOrderByIdAsc();
}

