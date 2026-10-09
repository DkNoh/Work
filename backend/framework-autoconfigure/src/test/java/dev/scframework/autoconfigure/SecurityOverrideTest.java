package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.web.SecurityFilterChain;

class SecurityOverrideTest {
    @Test
    void consumerSecurityChainReplacesTheDefaultConfiguration() {
        new WebApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(ScSecurityAutoConfiguration.class))
                .withUserConfiguration(ConsumerSecurity.class)
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(SecurityFilterChain.class);
                    assertThat(context).doesNotHaveBean("scSecurityFilterChain");
                    assertThat(context).doesNotHaveBean("scRequiredUserDetailsService");
                    assertThat(context).hasBean("scPasswordEncoder");
                });
    }

    @Test
    void missingAuthenticationAdapterFailsBeforeBootCanGenerateAUser() {
        new WebApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(ScSecurityAutoConfiguration.class,
                        SecurityAutoConfiguration.class, UserDetailsServiceAutoConfiguration.class))
                .withBean(ObjectMapper.class, ObjectMapper::new)
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure()).hasRootCauseMessage(
                            "Supply a UserDetailsService; generated/default passwords are disabled");
                });
    }

    @Configuration(proxyBeanMethods = false)
    static class ConsumerSecurity {
        @Bean SecurityFilterChain consumerChain() { return mock(SecurityFilterChain.class); }
    }
}
