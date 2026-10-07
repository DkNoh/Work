package dev.scframework.reference.identity;

import dev.scframework.core.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ActorResolver {
    private final UserRepository users;
    public ActorResolver(UserRepository users) { this.users = users; }
    /** 세션의 과거 authority 대신 매 요청의 현재 DB 역할과 숫자 ID를 사용한다. */
    @Transactional(readOnly = true)
    public UserEntity require(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) throw unauthenticated();
        return users.findByUsername(authentication.getName()).orElseThrow(ActorResolver::unauthenticated);
    }
    public void requireAdmin(UserEntity actor) {
        if (!actor.isAdmin()) throw new ApiException(403, "FORBIDDEN", "이 작업을 수행할 권한이 없습니다.");
    }
    private static ApiException unauthenticated() {
        return new ApiException(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
    }
}
