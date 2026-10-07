package dev.scframework.reference.media;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AnnotationRepository extends JpaRepository<AnnotationEntity,Long> {
    java.util.Optional<AnnotationEntity> findByRequirementId(long requirementId);
    java.util.List<AnnotationEntity> findByScreenVersionIdOrderByNumberAsc(long screenVersionId);
}

