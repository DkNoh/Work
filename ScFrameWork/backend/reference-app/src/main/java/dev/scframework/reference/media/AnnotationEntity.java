package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 요구사항당 박스 한 개를 저장한다. screenVersionId와 버전 내 number는 표시용이며 좌표는 EXIF 적용 축 기준 0~1이다.
 */

@Entity @Table(name="requirement_annotation")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class AnnotationEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    // 박스별 @Version을 따로 쓰지 않고 부모 요구사항의 revision을 먼저 확보한다. unique requirementId는 요청당 한 박스 계약을 강제한다.
    @Column(nullable=false,unique=true) Long requirementId;
    @Column(nullable=false) Long screenVersionId;
    @Column(nullable=false) int number;
    @Column(nullable=false) double x;
    @Column(nullable=false) double y;
    @Column(nullable=false) double width;
    @Column(nullable=false) double height;
}

