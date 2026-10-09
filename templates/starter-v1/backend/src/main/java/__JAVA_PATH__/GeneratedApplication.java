package __JAVA_PACKAGE__;
import __JAVA_PACKAGE__.integration.SampleClient;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.cloud.openfeign.EnableFeignClients;
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableFeignClients(clients = SampleClient.class)
public class GeneratedApplication {
    public static void main(String[] args) { SpringApplication.run(GeneratedApplication.class, args); }
}
