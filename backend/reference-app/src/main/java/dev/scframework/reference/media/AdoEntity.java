package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 요구사항 ID당 ADO 티켓/URL/연결자 메타데이터 한 건이다. 실제 ADO 서버 상태 확인이나 외부 API 호출 결과를 저장하는 모델은 아니다.
 */

@Entity @Table(name="requirement_ado")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class AdoEntity {
    @Id Long requirementId;
    @Column(nullable=false,length=80) String ticket;
    @Column(nullable=false,length=2000) String url;
    @Column(nullable=false) Long linkedBy;
    @Column(nullable=false) Instant linkedAt;
}

