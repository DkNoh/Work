package dev.scframework.reference;

import dev.scframework.reference.integration.ReferenceEchoClient;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.cloud.openfeign.EnableFeignClients;

/**
 * 独立 Reference 앱의 시작점이다. 업무 패키지만 스캔하고 공통 기능은 Starter 자동 구성으로 소비한다.
 * 기본 UserDetailsService 자동 구성을 제외해 실제 앱 DB 인증을 사용하며 Feign client는 명시한 하나만 등록한다.
 */

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableFeignClients(clients = ReferenceEchoClient.class)
public class ReferenceApplication {
    public static void main(String[] args) { SpringApplication.run(ReferenceApplication.class, args); }
}
