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

/*
 * 서버 준비 상태와 현재 세션의 CSRF 토큰을 제공하는 공통 REST Controller다. JSP view 이름을 반환하지 않는다.
 * health는 Boot readiness에 따라 200/503을 선택한다. csrf는 Security가 요청에 제공한 토큰을 JSON headerName/token으로 반환한다.
 */

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
    // 지연 생성 CSRF token을 읽어 현재 세션과 연결한다. 프런트는 여기서 받은 headerName을 그대로 다음 쓰기 요청에 사용한다.
    public CsrfResponse csrf(@Parameter(hidden = true) CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getToken());
    }

    public record HealthResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String application) {}
    public record CsrfResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String headerName,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String token) {}
}
