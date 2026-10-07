package dev.scframework.autoconfigure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 최소 소비 앱의 기본 me 계약. 업무 사용자 DTO는 앱이 별도 endpoint로 제공한다. */
@RestController
public class DefaultSessionEndpoints {
    @GetMapping("/api/auth/me")
    @Operation(summary = "현재 로그인 사용자")
    public SessionResponse me(@Parameter(hidden = true) Authentication authentication) {
        List<String> roles = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority().replaceFirst("^ROLE_", "")).toList();
        return new SessionResponse(authentication.getName(), roles);
    }

    public record SessionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String username,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> roles) {}
}
