package dev.scframework.reference.media;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 요구사항의 단일 박스와 화면 버전의 번호순 박스를 조회한다. 목록의 DRAFT 공개 범위는 MediaService에서 추가 적용한다.
 */

public interface AnnotationRepository extends JpaRepository<AnnotationEntity,Long> {
    java.util.Optional<AnnotationEntity> findByRequirementId(long requirementId);
    java.util.List<AnnotationEntity> findByScreenVersionIdOrderByNumberAsc(long screenVersionId);
}

