package dev.scframework.reference.reports;

import dev.scframework.reference.identity.ActorResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

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
