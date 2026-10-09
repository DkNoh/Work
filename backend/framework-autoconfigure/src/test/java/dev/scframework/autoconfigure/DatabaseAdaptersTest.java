package dev.scframework.autoconfigure;

import dev.scframework.autoconfigure.database.StandardDatabaseDialect;
import dev.scframework.autoconfigure.database.UtcInstantTypeHandler;
import dev.scframework.core.database.DatabaseDialect;
import java.time.Instant;
import java.util.Properties;
import java.util.TimeZone;
import java.util.UUID;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mybatis.spring.boot.autoconfigure.ConfigurationCustomizer;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.quartz.QuartzProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.quartz.SchedulerFactoryBean;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 자동 연결이 실제 라이브러리 구성에 반영되는지 검사한다. 외부 DB 실기동은 별도 계약 테스트가 담당한다. */
class DatabaseAdaptersTest {
    @ParameterizedTest @EnumSource(StandardDatabaseDialect.class)
    void quartzUsesVendorDelegateAndPreservesConsumerProperties(StandardDatabaseDialect dialect) {
        var beans=new DefaultListableBeanFactory();beans.registerSingleton("dialect",dialect);
        var settings=new QuartzProperties();settings.getProperties().put("org.quartz.threadPool.threadCount","2");
        var factory=mock(SchedulerFactoryBean.class);
        new ScSchedulerAutoConfiguration().scDatabaseQuartzCustomizer(source(),beans.getBeanProvider(DatabaseDialect.class),settings).customize(factory);
        var captured=ArgumentCaptor.forClass(Properties.class);verify(factory).setQuartzProperties(captured.capture());
        assertThat(captured.getValue()).containsEntry("org.quartz.threadPool.threadCount","2")
                .containsEntry("org.quartz.jobStore.driverDelegateClass",dialect.quartzDelegateClassName());
    }

    @Test void explicitQuartzDelegateWinsOverDefault() {
        var beans=new DefaultListableBeanFactory();var settings=new QuartzProperties();
        settings.getProperties().put("org.quartz.jobStore.driverDelegateClass","app.LegacyDelegate");
        var factory=mock(SchedulerFactoryBean.class);
        new ScSchedulerAutoConfiguration().scDatabaseQuartzCustomizer(source(),beans.getBeanProvider(DatabaseDialect.class),settings).customize(factory);
        var captured=ArgumentCaptor.forClass(Properties.class);verify(factory).setQuartzProperties(captured.capture());
        assertThat(captured.getValue()).containsEntry("org.quartz.jobStore.driverDelegateClass","app.LegacyDelegate");
    }

    @Test void mismatchFailsBeforeFlywayCreatesHistory() {
        var source=source();
        new ApplicationContextRunner().withConfiguration(AutoConfigurations.of(ScDatabaseAutoConfiguration.class,FlywayAutoConfiguration.class))
                .withBean(javax.sql.DataSource.class,()->source).withPropertyValues("SC_DB_VENDOR=oracle")
                .run(context->{
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure()).hasRootCauseMessage("SC_DATABASE_MIGRATION_VENDOR_MISMATCH");
                });
        assertThat(new JdbcTemplate(source).queryForObject("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE LOWER(TABLE_NAME)='flyway_schema_history'",Long.class)).isZero();
    }

    @Test void db2MyBatisInstantRoundTripsUtcWithNonUtcJvm() throws Exception {
        var runner=new ApplicationContextRunner().withConfiguration(AutoConfigurations.of(ScMyBatisDatabaseAutoConfiguration.class))
                .withBean(DatabaseDialect.class,()->StandardDatabaseDialect.DB2);
        runner.run(context->{
            var configuration=new org.apache.ibatis.session.Configuration();
            context.getBean(ConfigurationCustomizer.class).customize(configuration);
            assertThat(configuration.getTypeHandlerRegistry().getTypeHandler(Instant.class)).isInstanceOf(UtcInstantTypeHandler.class);
        });
        TimeZone previous=TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
            var source=source();var handler=new UtcInstantTypeHandler();Instant now=Instant.parse("2026-10-09T01:02:03.123456Z");
            try(var connection=source.getConnection()){
                connection.createStatement().execute("CREATE TABLE moment(value_at TIMESTAMP(6))");
                try(var insert=connection.prepareStatement("INSERT INTO moment VALUES(?)")){
                    handler.setNonNullParameter(insert,1,now,org.apache.ibatis.type.JdbcType.TIMESTAMP);insert.executeUpdate();
                }
                try(var rows=connection.createStatement().executeQuery("SELECT value_at FROM moment")){
                    assertThat(rows.next()).isTrue();assertThat(handler.getNullableResult(rows,1)).isEqualTo(now);
                    assertThat(handler.getNullableResult(rows,"value_at")).isEqualTo(now);
                }
            }
        }finally{TimeZone.setDefault(previous);}
    }

    @Test void sqlServerBootstrapUsesGeneratedIdentityAndDoesNotOverwriteExistingSchedule() {
        var source=source();var jdbc=new JdbcTemplate(source);
        // GENERATED ALWAYS는 H2에서도 명시 ID INSERT를 거절하여 SQL Server IDENTITY의 경계를 재현한다.
        jdbc.execute("CREATE TABLE operation_schedule(id BIGINT GENERATED ALWAYS AS IDENTITY(START WITH 100) PRIMARY KEY,job_code VARCHAR(64) UNIQUE,cron VARCHAR(120),time_zone VARCHAR(64),misfire_policy VARCHAR(20),enabled BOOLEAN,revision INTEGER,created_by VARCHAR(64),created_at TIMESTAMP WITH TIME ZONE,updated_at TIMESTAMP WITH TIME ZONE)");
        var task=new dev.scframework.core.scheduling.RegisteredOperationalTask(){
            @Override public String jobCode(){return "OUTBOX_DISPATCH";}
            @Override public void execute(dev.scframework.core.scheduling.ScheduledRunContext context){}
        };
        var manager=new org.springframework.jdbc.datasource.DataSourceTransactionManager(source);
        var settings=new dev.scframework.autoconfigure.scheduling.ScSchedulerProperties();settings.setBootstrapDefaults(true);
        var service=new dev.scframework.autoconfigure.scheduling.OperationalSchedulerService(source,manager,mock(org.quartz.Scheduler.class),
                new dev.scframework.autoconfigure.scheduling.RegisteredTaskRegistry(java.util.List.of(task)),java.time.Clock.systemUTC(),
                settings,new DefaultListableBeanFactory().getBeanProvider(dev.scframework.core.operations.OperationalEventSink.class),StandardDatabaseDialect.SQLSERVER);
        var tx=new org.springframework.transaction.support.TransactionTemplate(manager);
        tx.executeWithoutResult(status->service.bootstrapDefaults());
        assertThat(jdbc.queryForObject("SELECT id FROM operation_schedule",Long.class)).isEqualTo(100);
        jdbc.update("UPDATE operation_schedule SET enabled=FALSE,revision=7");
        tx.executeWithoutResult(status->service.bootstrapDefaults());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_schedule",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT revision FROM operation_schedule",Integer.class)).isEqualTo(7);
        assertThat(jdbc.queryForObject("SELECT enabled FROM operation_schedule",Boolean.class)).isFalse();
    }

    private static JdbcDataSource source(){var source=new JdbcDataSource();source.setURL("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1");return source;}
}
