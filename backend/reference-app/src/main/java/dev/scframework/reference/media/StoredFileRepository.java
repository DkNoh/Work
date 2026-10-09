package dev.scframework.reference.media;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 저장 파일 메타데이터의 JPA 저장소다. 레코드 삭제와 실제 blob 삭제의 시점 차이는 MediaService/lifecycle이 조정한다.
 */

public interface StoredFileRepository extends JpaRepository<StoredFileEntity,Long> {

}

