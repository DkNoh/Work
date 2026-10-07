package dev.scframework.autoconfigure;

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

@AutoConfiguration(afterName={"org.springframework.boot.autoconfigure.quartz.QuartzAutoConfiguration","dev.scframework.autoconfigure.ScAuditAutoConfiguration"})
@ConditionalOnClass(Scheduler.class)
@ConditionalOnProperty(prefix="sc.framework.scheduler",name="enabled",havingValue="true")
@EnableConfigurationProperties(ScSchedulerProperties.class)
public class ScSchedulerAutoConfiguration {
    @Bean @ConditionalOnMissingBean(name="scSafeRetentionTask")
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
            Scheduler scheduler,RegisteredTaskRegistry registry,Clock clock,ScSchedulerProperties properties,ObjectProvider<OperationalEventSink> events) {
        properties.validate();
        var service = new OperationalSchedulerService(source,manager,scheduler,registry,clock,properties,events);
        service.verifySchema(); return service;
    }
    @Bean @ConditionalOnMissingBean(name="scOperationalJobFactoryCustomizer")
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
