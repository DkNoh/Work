package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity @Table(name="requirement_annotation")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class AnnotationEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(nullable=false,unique=true) Long requirementId;
    @Column(nullable=false) Long screenVersionId;
    @Column(nullable=false) int number;
    @Column(nullable=false) double x;
    @Column(nullable=false) double y;
    @Column(nullable=false) double width;
    @Column(nullable=false) double height;
}

