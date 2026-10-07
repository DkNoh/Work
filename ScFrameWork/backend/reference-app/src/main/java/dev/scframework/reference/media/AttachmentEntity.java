package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity @Table(name="requirement_attachment")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class AttachmentEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(nullable=false) Long requirementId;
    @Column(nullable=false,unique=true) Long fileId;
    @Column(nullable=false) Instant createdAt;
}

