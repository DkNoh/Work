package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 요구사항과 저장 파일 ID를 연결하는 첨부 관계다. fileId 유일성으로 하나의 첨부 파일 관계를 유지한다.
 */

@Entity @Table(name="requirement_attachment")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class AttachmentEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(nullable=false) Long requirementId;
    @Column(nullable=false,unique=true) Long fileId;
    @Column(nullable=false) Instant createdAt;
}

