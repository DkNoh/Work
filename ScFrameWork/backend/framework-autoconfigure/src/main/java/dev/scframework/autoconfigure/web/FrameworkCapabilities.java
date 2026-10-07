package dev.scframework.autoconfigure.web;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "FrameworkCapabilities", description = "현재 서버에서 활성화한 선택 기능")
public record FrameworkCapabilities(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean messaging,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean scheduler,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean browserErrors,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean observability) {}
