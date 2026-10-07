package dev.scframework.autoconfigure.web;

import io.swagger.v3.oas.annotations.Operation;
import org.springframework.core.env.Environment;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import dev.scframework.core.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

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
