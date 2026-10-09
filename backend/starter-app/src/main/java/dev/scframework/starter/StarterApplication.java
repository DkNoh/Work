package dev.scframework.starter;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

/*
 * 최소 소비 앱의 Spring Boot 시작점이다. 같은 앱 패키지의 설정/Controller를 스캔하고 의존 Starter 자동설정을 소비한다.
 * Boot 기본 임의 사용자를 제외하고 AppAuthentication의 명시적 인증 어댑터로 기동한다.
 */

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class StarterApplication {
    public static void main(String[] args) { SpringApplication.run(StarterApplication.class, args); }
}
