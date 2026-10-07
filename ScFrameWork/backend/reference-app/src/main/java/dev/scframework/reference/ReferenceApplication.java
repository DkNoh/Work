package dev.scframework.reference;

import dev.scframework.reference.integration.ReferenceEchoClient;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableFeignClients(clients = ReferenceEchoClient.class)
public class ReferenceApplication {
    public static void main(String[] args) { SpringApplication.run(ReferenceApplication.class, args); }
}
