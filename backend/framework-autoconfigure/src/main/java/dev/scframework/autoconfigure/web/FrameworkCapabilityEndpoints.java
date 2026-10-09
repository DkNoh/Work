package dev.scframework.autoconfigure.web;

import io.swagger.v3.oas.annotations.Operation;
import org.springframework.core.env.Environment;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import dev.scframework.core.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/*
 * 인증 사용자에게 현재 활성 선택 기능 설정을 알려 주는 endpoint다.
 * 익명 Authentication까지 명시적으로 거절하고 설정 누락은 false로 처리한다. 기능 표시와 각 업무 권한 검사는 별개다.
 */

@RestController
public final class FrameworkCapabilityEndpoints {
    private final Environment environment;
    public FrameworkCapabilityEndpoints(Environment environment) { this.environment = environment; }
    @GetMapping("/api/framework/capabilities")
    @Operation(summary = "활성 선택 기능 조회")
    public FrameworkCapabilities capabilities(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ApiException(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
        }
        return new FrameworkCapabilities(enabled("messaging"), enabled("scheduler"),
                enabled("browser-errors"), enabled("observability"));
    }
    private boolean enabled(String feature) {
        return environment.getProperty("sc.framework." + feature + ".enabled", Boolean.class, false);
    }
}
