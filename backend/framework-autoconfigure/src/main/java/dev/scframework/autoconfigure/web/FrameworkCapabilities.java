package dev.scframework.autoconfigure.web;

import io.swagger.v3.oas.annotations.media.Schema;

/*
 * 현재 서버가 켠 네 가지 선택 기능을 boolean으로 전달하는 공개 응답이다.
 * 프런트는 서버 응답을 조회해 메뉴/기능 표시를 결정하며 이 DTO 자체가 사용자 권한을 부여하지 않는다.
 */

@Schema(name = "FrameworkCapabilities", description = "현재 서버에서 활성화한 선택 기능")
public record FrameworkCapabilities(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean messaging,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean scheduler,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean browserErrors,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean observability) {}
