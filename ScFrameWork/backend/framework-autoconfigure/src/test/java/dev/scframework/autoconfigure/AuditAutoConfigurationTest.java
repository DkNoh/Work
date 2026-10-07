package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import dev.scframework.autoconfigure.audit.JdbcSecurityAuditSink;
import dev.scframework.autoconfigure.audit.TransactionalSecurityAuditPublisher;
import dev.scframework.autoconfigure.web.CommonEndpoints;
import dev.scframework.autoconfigure.web.DefaultSessionEndpoints;
import dev.scframework.core.audit.SecurityAuditPublisher;
import dev.scframework.core.audit.SecurityAuditSink;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.transaction.PlatformTransactionManager;

class AuditAutoConfigurationTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(ScAuditAutoConfiguration.class));

    @Test void disabledMinimalConsumerNeedsNoDatasourceOrSchema() {
        runner.run(context -> {
            assertThat(context).hasNotFailed().hasSingleBean(Clock.class).hasSingleBean(SecurityAuditPublisher.class);
            assertThat(context).doesNotHaveBean(SecurityAuditSink.class).doesNotHaveBean(JdbcSecurityAuditSink.class);
            assertThat(context.getBean(ScFrameworkProperties.class).getAudit().isEnabled()).isFalse();
        });
    }

    @Test void consumerSinkAndClockBackOffDefaultsWithoutBeanOverride() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-06T00:00:00Z"), ZoneOffset.UTC);
        SecurityAuditSink sink = event -> { };
        runner.withPropertyValues("sc.framework.audit.enabled=true")
                .withBean(Clock.class, () -> clock).withBean(SecurityAuditSink.class, () -> sink)
                .withBean(DataSource.class, () -> mock(DataSource.class))
                .withBean(PlatformTransactionManager.class, () -> mock(PlatformTransactionManager.class))
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(SecurityAuditSink.class).hasSingleBean(Clock.class);
                    assertThat(context.getBean(Clock.class)).isSameAs(clock);
                    assertThat(context.getBean(SecurityAuditSink.class)).isSameAs(sink);
                    assertThat(context).doesNotHaveBean(JdbcSecurityAuditSink.class)
                            .hasSingleBean(TransactionalSecurityAuditPublisher.class);
                });
    }

    @Test void enabledAuditCannotSilentlyBecomeNoopWithoutStorage() {
        runner.withPropertyValues("sc.framework.audit.enabled=true").run(context -> assertThat(context).hasFailed());
    }

    @Test void meFlagOnlyDisablesDefaultSessionAndConsumerEndpointBacksOff() {
        new WebApplicationContextRunner().withConfiguration(AutoConfigurations.of(ScAuditAutoConfiguration.class,
                ScWebAutoConfiguration.class)).withPropertyValues("sc.framework.session-endpoint.enabled=false")
                .run(context -> {
                    assertThat(context).hasNotFailed().doesNotHaveBean(DefaultSessionEndpoints.class)
                            .hasSingleBean(CommonEndpoints.class);
                });
        var endpoint = new DefaultSessionEndpoints();
        new WebApplicationContextRunner().withConfiguration(AutoConfigurations.of(ScAuditAutoConfiguration.class,
                ScWebAutoConfiguration.class)).withBean(DefaultSessionEndpoints.class, () -> endpoint)
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(DefaultSessionEndpoints.class);
                    assertThat(context.getBean(DefaultSessionEndpoints.class)).isSameAs(endpoint);
                    assertThat(context).doesNotHaveBean("scDefaultSessionEndpoints");
                });
    }
}
