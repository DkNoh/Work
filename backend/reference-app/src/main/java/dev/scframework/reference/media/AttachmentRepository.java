package dev.scframework.reference.media;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 요구사항의 첨부 목록과 파일의 소유 관계를 찾는다. 다운로드 권한 검사와 삭제 시 대상 요구사항 확인에 쓰인다.
 */

public interface AttachmentRepository extends JpaRepository<AttachmentEntity,Long> {
    java.util.List<AttachmentEntity> findByRequirementIdOrderByIdAsc(long requirementId);
    java.util.Optional<AttachmentEntity> findByFileId(long fileId);
}

