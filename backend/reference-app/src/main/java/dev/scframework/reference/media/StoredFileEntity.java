package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * blob의 내부 key와 공개 표시 이름/MIME/크기만 DB에 저장한다. 원본 bytes는 이 엔티티/웹 정적 경로에 넣지 않는다.
 */

@Entity @Table(name="stored_file")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class StoredFileEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    // storageKey는 파일 시스템 경로 입력을 대신하는 서버 내부 식별자다. 사용자 filename을 저장소 경로로 사용하지 않는다.
    @Column(nullable=false,length=36,unique=true) String storageKey;
    @Column(nullable=false,length=180) String originalName;
    @Column(nullable=false,length=100) String mime;
    @Column(nullable=false) long size;
    @Column(nullable=false) Long createdBy;
    @Column(nullable=false) Instant createdAt;
}

