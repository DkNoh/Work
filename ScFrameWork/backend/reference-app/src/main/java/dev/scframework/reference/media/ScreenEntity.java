package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 업무 메뉴에 속하는 참고 화면과 다음 버전 번호를 저장한다. 업로드에서 이 행을 잠가 nextVersion 배정을 직렬화한다.
 */

@Entity @Table(name="screen_entry")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class ScreenEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(nullable=false) Long menuId;
    @Column(nullable=false,length=200) String name;
    @Column(nullable=false) int nextVersion=1;
}

