package dev.scframework.starter.operations.scheduling;

import dev.scframework.core.ApiException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

/*
 * 공통 운영 서비스에 넘길 인증 주체를 앱의 UserDetailsService에서 다시 조회하는 어댑터다.
 * 세션 Authentication의 이름으로 현재 역할을 읽고 익명/사라진 사용자와 ADMIN 여부를 구분한다.
 * 사용자 업무 DB를 갖지 않는 최소 앱이므로 Actor.getId는 null이며 username이 subject다.
 */

/** 최소 앱은 사용자 업무 DB를 복사하지 않고 현재 인증 provider의 subject/역할을 읽는다. */
@Component
@ConditionalOnExpression("${sc.framework.scheduler.enabled:false} or ${sc.framework.browser-errors.enabled:false}")
public class StarterOperationalActor {
    private final UserDetailsService users;
    public StarterOperationalActor(UserDetailsService users){this.users=users;}
    // 인증 세션을 확인한 뒤 UserDetailsService에서 현재 사용자를 다시 읽는다. 세션에 남은 옛 역할만 신뢰하지 않는다.
    public Actor require(Authentication authentication){
        if(authentication==null||!authentication.isAuthenticated()||authentication instanceof AnonymousAuthenticationToken)throw unauthenticated();
        try{var current=users.loadUserByUsername(authentication.getName());return new Actor(current.getUsername(),current.getAuthorities().stream().anyMatch(role->role.getAuthority().equals("ROLE_ADMIN")));}
        catch(org.springframework.security.core.userdetails.UsernameNotFoundException missing){throw unauthenticated();}
    }
    public void requireAdmin(Actor actor){if(!actor.admin())throw new ApiException(403,"FORBIDDEN","이 작업을 수행할 권한이 없습니다.");}
    private static ApiException unauthenticated(){return new ApiException(401,"AUTH_REQUIRED","로그인이 필요합니다.");}
    public record Actor(String username,boolean admin){public String getUsername(){return username;}public Long getId(){return null;}}
}
