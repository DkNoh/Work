package dev.scframework.reference.media;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 화면별 최신 버전 목록과 파일 ID의 화면 버전 관계를 조회한다. 이 관계로 이미지 inline 응답 여부를 판정한다.
 */

public interface ScreenVersionRepository extends JpaRepository<ScreenVersionEntity,Long> {
    java.util.List<ScreenVersionEntity> findByScreenIdOrderByVersionDesc(long screenId);
    java.util.Optional<ScreenVersionEntity> findByFileId(long fileId);
}

