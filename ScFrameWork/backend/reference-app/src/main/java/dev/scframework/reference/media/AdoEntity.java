package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity @Table(name="requirement_ado")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class AdoEntity {
    @Id Long requirementId;
    @Column(nullable=false,length=80) String ticket;
    @Column(nullable=false,length=2000) String url;
    @Column(nullable=false) Long linkedBy;
    @Column(nullable=false) Instant linkedAt;
}

