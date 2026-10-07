package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity @Table(name="screen_version")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class ScreenVersionEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(nullable=false) Long screenId;
    @Column(nullable=false) int version;
    @Column(nullable=false,unique=true) Long fileId;
    @Column(nullable=false) int width;
    @Column(nullable=false) int height;
    @Column(nullable=false) Long createdBy;
    @Column(nullable=false) Instant createdAt;
    @Column(nullable=false) int archived;
    @Column(nullable=false) int nextAnnotation=1;
}

