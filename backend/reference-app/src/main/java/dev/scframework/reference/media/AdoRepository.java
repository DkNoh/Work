package dev.scframework.reference.media;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 요구사항 ID를 키로 ADO 연결 메타데이터를 읽고 쓴다. 수정 권한/상태/revision/URL 검증은 RequirementService가 먼저 처리한다.
 */

public interface AdoRepository extends JpaRepository<AdoEntity,Long> {

}

