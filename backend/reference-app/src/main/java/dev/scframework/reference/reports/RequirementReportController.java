package dev.scframework.reference.reports;

import dev.scframework.reference.identity.ActorResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Vue 보고서/실제 대시보드의 읽기 전용 HTTP 경계다. 기존 요구사항 CRUD와 별도로 집계/정렬/서버 페이징 계약을 제공한다.
 */

@RestController
@RequestMapping("/api/reports/requirements")
public class RequirementReportController {
    private final RequirementReportService reports;
    private final ActorResolver actors;
    public RequirementReportController(RequirementReportService reports, ActorResolver actors) {
        this.reports = reports; this.actors = actors;
    }

    @GetMapping
    @Operation(operationId = "requirementReport", summary = "요구사항 집계 보고서 조회")
    // q의 앞뒤 공백도 검색 의미로 보존한다. 정렬 문자열은 Service allowlist 검증 후 Mapper로 들어가며 임의 SQL 조각으로 쓰지 않는다.
    public RequirementReportDtos.RequirementReportPage report(
            @Parameter(description = "제목의 literal 부분 문자열, 앞뒤 공백 보존", schema = @Schema(maxLength = 200))
            @RequestParam(defaultValue = "") String q, @RequestParam(required = false) Long menuId,
            @RequestParam(defaultValue = "") String status, @RequestParam(required = false) Long authorId,
            @RequestParam(required = false) Long screenVersionId,
            @Parameter(schema = @Schema(type = "integer", format = "int32", minimum = "0", maximum = "1000000", defaultValue = "0")) @RequestParam(defaultValue = "0") int page,
            @Parameter(schema = @Schema(type = "integer", format = "int32", minimum = "1", maximum = "100", defaultValue = "20")) @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "생략 시 최근 수정/ID 내림차순", schema = @Schema(allowableValues = {"updatedAt", "title", "commentCount", "historyCount", "lastCommentAt"}))
            @RequestParam(required = false) String sort,
            @Parameter(description = "sort를 지정한 경우에만 사용, 생략 시 desc", schema = @Schema(allowableValues = {"asc", "desc"}))
            @RequestParam(required = false) String direction, Authentication authentication) {
        return reports.report(q, menuId, status, authorId, screenVersionId, page, size, sort, direction,
                actors.require(authentication));
    }
}
