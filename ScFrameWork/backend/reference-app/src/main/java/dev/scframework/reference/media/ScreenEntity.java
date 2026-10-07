package dev.scframework.reference.media;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity @Table(name="screen_entry")
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class ScreenEntity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(nullable=false) Long menuId;
    @Column(nullable=false,length=200) String name;
    @Column(nullable=false) int nextVersion=1;
}

