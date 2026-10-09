package dev.scframework.reference.example;

import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 공통 표가 소비하는 서버 페이징 응답이다. items는 현재 페이지이고 total은 전체 조회 건수다.
 * page는 0부터 시작하며 성공 응답을 추가 success/data 봉투로 감싸지 않는다.
 */

public record ExamplePage(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ExampleDto> items,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int page,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int size) {}
