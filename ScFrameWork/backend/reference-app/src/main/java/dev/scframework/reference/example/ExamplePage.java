package dev.scframework.reference.example;

import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

public record ExamplePage(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ExampleDto> items,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int page,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int size) {}
