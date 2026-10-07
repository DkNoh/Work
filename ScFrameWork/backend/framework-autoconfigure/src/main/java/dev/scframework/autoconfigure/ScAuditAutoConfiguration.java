package dev.scframework.autoconfigure;

import dev.scframework.autoconfigure.audit.AuditWriteDiagnostics;
import dev.scframework.autoconfigure.audit.JdbcSecurityAuditSink;
import dev.scframework.autoconfigure.audit.RequestAuditRecorder;
import dev.scframework.autoconfigure.audit.TransactionalSecurityAuditPublisher;
import dev.scframework.core.audit.SecurityAuditPublisher;
import dev.scframework.core.audit.SecurityAuditSink;
import java.time.Clock;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.context.annotation.Bean;
import org.springframework.transaction.PlatformTransactionManager;

@AutoConfiguration(before = {ScSecurityAutoConfiguration.class, ScWebAutoConfiguration.class},
        afterName = {"org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration",
                "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration",
                "org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration"})
@EnableConfigurationProperties(ScFrameworkProperties.class)
public class ScAuditAutoConfiguration {
    @Bean @ConditionalOnMissingBean(Clock.class)
    Clock scClock() { return Clock.systemUTC(); }

    @Bean @ConditionalOnMissingBean(AuditWriteDiagnostics.class)
    AuditWriteDiagnostics scAuditWriteDiagnostics() { return new AuditWriteDiagnostics(); }

    @Bean @ConditionalOnMissingBean(SecurityAuditSink.class) @ConditionalOnBean(DataSource.class)
    @ConditionalOnProperty(prefix = "sc.framework.audit", name = "enabled", havingValue = "true")
    @DependsOnDatabaseInitialization
    JdbcSecurityAuditSink scJdbcSecurityAuditSink(DataSource dataSource) { return new JdbcSecurityAuditSink(dataSource); }

    @Bean @ConditionalOnMissingBean(SecurityAuditPublisher.class)
    @ConditionalOnProperty(prefix = "sc.framework.audit", name = "enabled", havingValue = "true")
    TransactionalSecurityAuditPublisher scSecurityAuditPublisher(SecurityAuditSink sink,
            PlatformTransactionManager transactionManager, AuditWriteDiagnostics diagnostics) {
        return new TransactionalSecurityAuditPublisher(sink, transactionManager, diagnostics);
    }

    @Bean @ConditionalOnMissingBean(SecurityAuditPublisher.class)
    @ConditionalOnProperty(prefix = "sc.framework.audit", name = "enabled", havingValue = "false", matchIfMissing = true)
    SecurityAuditPublisher scDisabledAuditPublisher() { return event -> { }; }

    @Bean @ConditionalOnMissingBean(RequestAuditRecorder.class)
    RequestAuditRecorder scRequestAuditRecorder(SecurityAuditPublisher publisher, Clock clock,
            AuditWriteDiagnostics diagnostics) { return new RequestAuditRecorder(publisher, clock, diagnostics); }
}
