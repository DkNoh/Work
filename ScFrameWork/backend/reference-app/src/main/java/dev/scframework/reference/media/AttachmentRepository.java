package dev.scframework.reference.media;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AttachmentRepository extends JpaRepository<AttachmentEntity,Long> {
    java.util.List<AttachmentEntity> findByRequirementIdOrderByIdAsc(long requirementId);
    java.util.Optional<AttachmentEntity> findByFileId(long fileId);
}

