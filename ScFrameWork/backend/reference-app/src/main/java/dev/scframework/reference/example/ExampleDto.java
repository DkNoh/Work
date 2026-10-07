package dev.scframework.reference.example;

import io.swagger.v3.oas.annotations.media.Schema;

public record ExampleDto(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int revision) {
    static ExampleDto from(ExampleEntry entry) {
        return new ExampleDto(entry.getId(), entry.getTitle(), entry.getRevision());
    }
}
