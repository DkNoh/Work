package dev.scframework.reference.media;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScreenVersionRepository extends JpaRepository<ScreenVersionEntity,Long> {
    java.util.List<ScreenVersionEntity> findByScreenIdOrderByVersionDesc(long screenId);
    java.util.Optional<ScreenVersionEntity> findByFileId(long fileId);
}

