package dev.scframework.reference.identity;

import dev.scframework.core.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인증 객체에서 사용자명을 얻은 뒤 현재 DB 사용자 ID/역할을 확인하는 업무 권한 진입점이다.
 * 로그인 당시 세션 authority가 오래되었더라도 현재 업무 판단은 새로 읽은 actor를 사용한다.
 */

@Component
public class ActorResolver {
    private final UserRepository users;
    public ActorResolver(UserRepository users) { this.users = users; }
    /** 세션의 과거 authority 대신 매 요청의 현재 DB 역할과 숫자 ID를 사용한다. */
    @Transactional(readOnly = true)
    // 익명/만료 인증을 401로 거절한다. 숫자 actor ID를 클라이언트 요청에서 받지 않고 인증 username의 현재 DB 행에서 얻는다.
    public UserEntity require(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) throw unauthenticated();
        return users.findByUsername(authentication.getName()).orElseThrow(ActorResolver::unauthenticated);
    }
    // 관리 기능이 실제 데이터 변경/조회 전에 호출하는 최종 역할 확인이다. 프런트 버튼 숨김만으로 보호하지 않는다.
    public void requireAdmin(UserEntity actor) {
        if (!actor.isAdmin()) throw new ApiException(403, "FORBIDDEN", "이 작업을 수행할 권한이 없습니다.");
    }
    private static ApiException unauthenticated() {
        return new ApiException(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
    }
}
