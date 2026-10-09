package __JAVA_PACKAGE__;
import __JAVA_PACKAGE__.integration.SampleClient;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.cloud.openfeign.EnableFeignClients;

/*
 * 생성된 독립 앱의 Spring Boot 시작점이다. __JAVA_PACKAGE__는 생성기가 사용자가 선택한 패키지로 치환한다.
 * Feign client는 SampleClient 한 개를 명시 등록한다. 다른 앱/Reference 구현을 통째로 스캔하지 않는다.
 * Boot 기본 사용자를 제외하고 자기 AppAuthentication 및 앱 소유 migration을 사용한다.
 */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableFeignClients(clients = SampleClient.class)
public class GeneratedApplication {
    public static void main(String[] args) { SpringApplication.run(GeneratedApplication.class, args); }
}
