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

/*
 * 공통 감사 bean을 조건에 맞춰 조립하는 Spring Boot 자동설정이다. @Bean의 인수는 Spring이 주입한다.
 * 활성 시 앱 소유 스키마에 JDBC sink/트랜잭션 publisher를 연결하고 비활성 시 no-op publisher를 제공한다.
 * ConditionalOnMissingBean은 소비 앱이 같은 SPI 구현을 제공했을 때 기본 구현이 물러나는 교체 지점이다.
 */

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
    // @DependsOnDatabaseInitialization은 앱 Flyway 실행 뒤 스키마를 확인하게 한다. 공통은 DDL을 실행하지 않는다.
    JdbcSecurityAuditSink scJdbcSecurityAuditSink(DataSource dataSource) { return new JdbcSecurityAuditSink(dataSource); }

    @Bean @ConditionalOnMissingBean(SecurityAuditPublisher.class)
    @ConditionalOnProperty(prefix = "sc.framework.audit", name = "enabled", havingValue = "true")
    // 기본 감사 구현은 업무 완료 후 별도 TX 저장이다. durable 모드가 먼저 Publisher를 제공하면 이 bean은 생성되지 않는다.
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
