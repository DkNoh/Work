package dev.scframework.autoconfigure.web;

import dev.scframework.autoconfigure.ScFrameworkProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CommonEndpoints {
    private final ScFrameworkProperties properties;
    private final ApplicationAvailability availability;

    public CommonEndpoints(ScFrameworkProperties properties) { this(properties, null); }
    public CommonEndpoints(ScFrameworkProperties properties, ApplicationAvailability availability) {
        this.properties = properties;
        this.availability = availability;
    }

    @GetMapping("/api/health")
    @Operation(summary = "애플리케이션 기본 상태", security = {})
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "초기 준비 완료", content = @Content(schema = @Schema(implementation = HealthResponse.class))),
        @ApiResponse(responseCode = "503", description = "초기 준비 중", content = @Content(schema = @Schema(implementation = HealthResponse.class)))
    })
    public ResponseEntity<HealthResponse> health() {
        boolean ready = availability == null || availability.getReadinessState() == ReadinessState.ACCEPTING_TRAFFIC;
        return ResponseEntity.status(ready ? 200 : 503)
                .body(new HealthResponse(ready ? "UP" : "STARTING", properties.getApplicationName()));
    }

    @GetMapping("/api/auth/csrf")
    @Operation(summary = "현재 세션의 CSRF 토큰 발급", security = {})
    public CsrfResponse csrf(@Parameter(hidden = true) CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getToken());
    }

    public record HealthResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String application) {}
    public record CsrfResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String headerName,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String token) {}
}
