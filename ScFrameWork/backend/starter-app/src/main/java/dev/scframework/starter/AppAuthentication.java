package dev.scframework.starter;

import dev.scframework.autoconfigure.security.SecretFileUsers;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration(proxyBeanMethods = false)
public class AppAuthentication {
    @Bean
    UserDetailsService starterUsers(Environment environment, PasswordEncoder encoder) {
        return SecretFileUsers.load(environment.getProperty("SC_BOOTSTRAP_SECRET_FILE"),
                environment.getProperty("SC_BOOTSTRAP_USERNAME", "admin"), encoder);
    }
}
