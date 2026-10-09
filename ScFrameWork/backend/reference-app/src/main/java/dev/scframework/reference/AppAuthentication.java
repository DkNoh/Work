package dev.scframework.reference;

import dev.scframework.reference.identity.UserRepository;
import dev.scframework.reference.identity.UserService;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

/**
 * 공통 세션 보안과 Reference의 사용자 DB를 연결한다. 인증 시 DB의 해시/역할을 UserDetails로 공급한다.
 * 부트스트랩은 실행 시 UserService로 위임하며 비밀번호 원문이나 파일 내용을 로그/응답에 노출하지 않는다.
 */

@Configuration(proxyBeanMethods = false)
public class AppAuthentication {
    @Bean
    // 인증 시 username으로 DB를 읽고 해시만 PasswordEncoder 검증 대상으로 전달한다. 업무 API는 이후 ActorResolver로 현재 역할을 다시 읽는다.
    UserDetailsService referenceUsers(UserRepository users) {
        return username -> users.findByUsername(username)
                .map(user -> User.withUsername(user.getUsername()).password(user.getPasswordHash()).roles(user.getRole()).build())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }
    @Bean
    // 애플리케이션 시작 후 초기 사용자 준비를 실행한다. 파일 모드/비밀번호 로딩 정책은 공통 SecretFileUsers와 실행 스크립트가 담당한다.
    ApplicationRunner referenceBootstrap(UserService users, Environment environment) {
        return args -> users.bootstrap(environment);
    }
}
