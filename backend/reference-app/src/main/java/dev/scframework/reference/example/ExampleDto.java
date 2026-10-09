package dev.scframework.reference.example;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 엔티티의 공개 id/title/revision만 전달하는 응답이다. 프런트는 받은 revision을 다음 수정의 편집 기준으로 보관한다.
 */

public record ExampleDto(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int revision) {
    static ExampleDto from(ExampleEntry entry) {
        return new ExampleDto(entry.getId(), entry.getTitle(), entry.getRevision());
    }
}
