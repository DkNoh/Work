package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 특정 화면의 불변 파일 버전과 표시 치수·보관 여부·다음 박스 번호를 보유한다.
 * archived는 기존 숫자 0/1 계약이며 보관은 기존 자료를 지우는 동작이 아니다.
 */

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
    // 새 박스 번호 배정은 MediaService가 버전 행 쓰기 잠금 안에서 수행한다. 동시 추가가 같은 번호를 가져가지 않게 한다.
    @Column(nullable=false) int nextAnnotation=1;
}

