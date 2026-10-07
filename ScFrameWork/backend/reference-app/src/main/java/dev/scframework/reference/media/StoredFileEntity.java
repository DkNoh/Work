package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity @Table(name="stored_file")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class StoredFileEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(nullable=false,length=36,unique=true) String storageKey;
    @Column(nullable=false,length=180) String originalName;
    @Column(nullable=false,length=100) String mime;
    @Column(nullable=false) long size;
    @Column(nullable=false) Long createdBy;
    @Column(nullable=false) Instant createdAt;
}

