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

@Configuration(proxyBeanMethods = false)
public class AppAuthentication {
    @Bean
    UserDetailsService referenceUsers(UserRepository users) {
        return username -> users.findByUsername(username)
                .map(user -> User.withUsername(user.getUsername()).password(user.getPasswordHash()).roles(user.getRole()).build())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }
    @Bean
    ApplicationRunner referenceBootstrap(UserService users, Environment environment) {
        return args -> users.bootstrap(environment);
    }
}
