package dev.scframework.autoconfigure;

import dev.scframework.core.database.DatabaseDialect;
import dev.scframework.autoconfigure.database.StandardDatabaseDialect;

import dev.scframework.autoconfigure.scheduling.*;
import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.operations.OperationalEventSink;
import dev.scframework.autoconfigure.browsererrors.BrowserErrorService;
import dev.scframework.autoconfigure.messaging.JdbcMessageStore;
import dev.scframework.autoconfigure.messaging.ScMessagingProperties;
import dev.scframework.core.scheduling.ScheduledRunContext;
import java.time.Clock;
import javax.sql.DataSource;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.quartz.SchedulerFactoryBeanCustomizer;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.context.annotation.Bean;
import org.springframework.transaction.PlatformTransactionManager;

/*
 * scheduler.enabled와 Quartz 존재 조건에서 등록 작업 레지스트리/예약 서비스를 조립한다.
 * 앱 migration을 확인하고 Quartz JobFactory는 RegisteredTaskDispatcherJob만 만들도록 제한한다.
 * SAFE_RETENTION 작업은 존재하는 메시지/브라우저/실행 이력 저장소의 정리 기능을 한 작업으로 연결한다.
 */

@AutoConfiguration(afterName={"org.springframework.boot.autoconfigure.quartz.QuartzAutoConfiguration","dev.scframework.autoconfigure.ScAuditAutoConfiguration"})
@ConditionalOnClass(Scheduler.class)
@ConditionalOnProperty(prefix="sc.framework.scheduler",name="enabled",havingValue="true")
@EnableConfigurationProperties(ScSchedulerProperties.class)
public class ScSchedulerAutoConfiguration {
    @Bean @ConditionalOnMissingBean(name="scDatabaseQuartzCustomizer")
    // Quartz의 BLOB/Boolean/잠금 SQL도 제품마다 다르다. 앱의 명시 delegate는 보존하고 metadata 기본값만 채운다.
    SchedulerFactoryBeanCustomizer scDatabaseQuartzCustomizer(DataSource source,ObjectProvider<DatabaseDialect> dialect,
            org.springframework.boot.autoconfigure.quartz.QuartzProperties quartz) {
        return factory -> {
            var properties=new java.util.Properties();properties.putAll(quartz.getProperties());
            properties.putIfAbsent("org.quartz.jobStore.driverDelegateClass",
                    dialect.getIfAvailable(()->StandardDatabaseDialect.detect(source)).quartzDelegateClassName());
            factory.setQuartzProperties(properties);
        };
    }
    @Bean @ConditionalOnMissingBean(name="scSafeRetentionTask")
    // 선택 모듈이 없으면 해당 저장소 정리를 생략한다. 실행 중인 작업/미완료 메시지는 각 retention 메서드가 제외한다.
    RegisteredOperationalTask scSafeRetentionTask(ObjectProvider<JdbcMessageStore> messages,ObjectProvider<ScMessagingProperties> messagingProperties,
            ObjectProvider<BrowserErrorService> browsers,ObjectProvider<OperationalSchedulerService> scheduler,Clock clock) {
        return new RegisteredOperationalTask() {
            @Override public String jobCode(){return "SAFE_RETENTION";}
            @Override public void execute(ScheduledRunContext context) {
                var store=messages.getIfAvailable();var props=messagingProperties.getIfAvailable();
                if(store!=null&&props!=null)store.retain(clock.instant().minus(java.time.Duration.ofDays(props.getRetentionDays())));
                var browser=browsers.getIfAvailable();if(browser!=null)browser.retain();
                scheduler.getObject().retainFinishedRuns();
            }
        };
    }
    @Bean @ConditionalOnMissingBean
    RegisteredTaskRegistry scRegisteredTaskRegistry(ObjectProvider<RegisteredOperationalTask> tasks) {
        return new RegisteredTaskRegistry(tasks.orderedStream().toList());
    }
    @Bean @ConditionalOnMissingBean
    @DependsOnDatabaseInitialization
    OperationalSchedulerService scOperationalSchedulerService(DataSource source,PlatformTransactionManager manager,
            Scheduler scheduler,RegisteredTaskRegistry registry,Clock clock,ScSchedulerProperties properties,ObjectProvider<OperationalEventSink> events,ObjectProvider<DatabaseDialect> dialect) {
        properties.validate();
        var service = new OperationalSchedulerService(source,manager,scheduler,registry,clock,properties,events,dialect.getIfAvailable(()->StandardDatabaseDialect.detect(source)));
        service.verifySchema(); return service;
    }
    @Bean @ConditionalOnMissingBean(name="scOperationalJobFactoryCustomizer")
    // DB에 임의 Java 클래스가 기록돼도 실행하지 않도록 허용 Job 클래스 하나만 인스턴스화한다.
    SchedulerFactoryBeanCustomizer scOperationalJobFactoryCustomizer(ObjectProvider<OperationalSchedulerService> service) {
        return factory -> factory.setJobFactory((bundle,scheduler) -> {
            if (bundle.getJobDetail().getJobClass() != RegisteredTaskDispatcherJob.class)
                throw new SchedulerException("Unregistered operational job class");
            return new RegisteredTaskDispatcherJob(service.getObject());
        });
    }
    @Bean @ConditionalOnMissingBean(name="scOperationalSchedulesBootstrap")
    SmartInitializingSingleton scOperationalSchedulesBootstrap(OperationalSchedulerService service) {
        return service::bootstrapDefaults;
    }
}
