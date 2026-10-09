package dev.scframework.starter;

import dev.scframework.autoconfigure.security.SecretFileUsers;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;

/*
 * 최소 앱의 인증 어댑터를 Spring bean으로 등록한다. 공통 Starter는 앱의 UserDetailsService를 소비한다.
 * 환경 설정의 새 private 파일 경로/사용자명을 SecretFileUsers에 넘기며 이 클래스에서 값을 생성/출력하지 않는다.
 * PasswordEncoder는 공통/앱 설정에서 주입받아 동일 인증 해시 계약을 사용한다.
 */

@Configuration(proxyBeanMethods = false)
public class AppAuthentication {
    @Bean
    UserDetailsService starterUsers(Environment environment, PasswordEncoder encoder) {
        return SecretFileUsers.load(environment.getProperty("SC_BOOTSTRAP_SECRET_FILE"),
                environment.getProperty("SC_BOOTSTRAP_USERNAME", "admin"), encoder);
    }
}
