package dev.scframework.starter.operations.scheduling;

import dev.scframework.core.ApiException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

/** 최소 앱은 사용자 업무 DB를 복사하지 않고 현재 인증 provider의 subject/역할을 읽는다. */
@Component
@ConditionalOnExpression("${sc.framework.scheduler.enabled:false} or ${sc.framework.browser-errors.enabled:false}")
public class StarterOperationalActor {
    private final UserDetailsService users;
    public StarterOperationalActor(UserDetailsService users){this.users=users;}
    public Actor require(Authentication authentication){
        if(authentication==null||!authentication.isAuthenticated()||authentication instanceof AnonymousAuthenticationToken)throw unauthenticated();
        try{var current=users.loadUserByUsername(authentication.getName());return new Actor(current.getUsername(),current.getAuthorities().stream().anyMatch(role->role.getAuthority().equals("ROLE_ADMIN")));}
        catch(org.springframework.security.core.userdetails.UsernameNotFoundException missing){throw unauthenticated();}
    }
    public void requireAdmin(Actor actor){if(!actor.admin())throw new ApiException(403,"FORBIDDEN","이 작업을 수행할 권한이 없습니다.");}
    private static ApiException unauthenticated(){return new ApiException(401,"AUTH_REQUIRED","로그인이 필요합니다.");}
    public record Actor(String username,boolean admin){public String getUsername(){return username;}public Long getId(){return null;}}
}
