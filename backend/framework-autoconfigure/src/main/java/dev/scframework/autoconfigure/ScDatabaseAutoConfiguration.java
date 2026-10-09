package dev.scframework.autoconfigure;

import dev.scframework.autoconfigure.database.StandardDatabaseDialect;
import dev.scframework.core.database.DatabaseDialect;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/**
 * 앱의 DataSource가 준비되면 실제 JDBC 제품명으로 공통 dialect를 만든다.
 * 고객 앱의 DatabaseDialect bean이 있으면 기본 구현은 물러난다. 공통 코드의 수정/복사 없이 확장한다.
 * DB 종류는 비밀값이 없는 metadata로 판단하며 migration 실행/스키마 소유권은 소비 앱에 남긴다.
 */
@AutoConfiguration(afterName="org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration",
        beforeName="org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
        before={ScAuditAutoConfiguration.class, ScMessagingAutoConfiguration.class, ScBrowserErrorsAutoConfiguration.class, ScSchedulerAutoConfiguration.class})
@ConditionalOnBean(DataSource.class)
public class ScDatabaseAutoConfiguration {
    @Bean @ConditionalOnMissingBean(DatabaseDialect.class)
    DatabaseDialect scDatabaseDialect(DataSource source) { return StandardDatabaseDialect.detect(source); }

    @Configuration(proxyBeanMethods=false)
    @ConditionalOnClass(org.flywaydb.core.Flyway.class)
    static class MigrationVendorGuard {
        @Bean
        // Flyway가 DDL을 실행하기 전에 선택 migration과 실제 연결 제품이 맞는지 검사한다.
        // 별도 Flyway DataSource를 지정한 앱도 그 연결의 metadata를 검사하며 URL/비밀번호는 오류에 싣지 않는다.
        org.springframework.boot.autoconfigure.flyway.FlywayConfigurationCustomizer scMigrationVendorGuard(Environment environment) {
            return configuration -> {
                String expected=environment.getProperty("SC_DB_VENDOR");
                if(expected==null||expected.isBlank())return;
                if(!expected.equals(StandardDatabaseDialect.detect(configuration.getDataSource()).id()))
                    throw new IllegalStateException("SC_DATABASE_MIGRATION_VENDOR_MISMATCH");
            };
        }
    }
}
