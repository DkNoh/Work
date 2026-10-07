package dev.scframework.autoconfigure;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.autoconfigure.browsererrors.*;
import dev.scframework.core.operations.OperationalEventSink;
import java.time.Clock;
import javax.sql.DataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Profile;
import org.springdoc.core.customizers.OpenApiCustomizer;
import io.swagger.v3.oas.models.media.IntegerSchema;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;

@AutoConfiguration(afterName={"dev.scframework.autoconfigure.ScAuditAutoConfiguration","org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration"})
@ConditionalOnProperty(prefix="sc.framework.browser-errors",name="enabled",havingValue="true")
@EnableConfigurationProperties(ScBrowserErrorsProperties.class)
public class ScBrowserErrorsAutoConfiguration {
    @Bean @Profile("dev") @ConditionalOnClass(OpenApiCustomizer.class)
    @ConditionalOnMissingBean(name="scBrowserErrorJsonContracts")
    OpenApiCustomizer scBrowserErrorJsonContracts() {
        return api -> {
            if(api.getComponents()==null||api.getComponents().getSchemas()==null)return;
            var owner=api.getComponents().getSchemas().get("BrowserErrorInput");
            if(owner==null)return;
            // 3.1 변환에서 annotation type이 string으로 바뀌어도 실제 숫자 JSON 계약을 보존한다.
            var version=new IntegerSchema();version.setTypes(java.util.Set.of("integer"));version.setFormat("int32");
            version.setMinimum(java.math.BigDecimal.ONE);version.setMaximum(java.math.BigDecimal.ONE);version.setEnum(java.util.List.of(1));
            owner.addProperty("schemaVersion",version);
        };
    }
    @Bean @ConditionalOnMissingBean
    BrowserErrorRateLimiter scBrowserErrorRateLimiter(Clock clock,ScBrowserErrorsProperties properties){properties.validate();return new BrowserErrorRateLimiter(clock,properties);}
    @Bean @ConditionalOnMissingBean @DependsOnDatabaseInitialization
    BrowserErrorService scBrowserErrorService(DataSource source,Clock clock,ScBrowserErrorsProperties properties,BrowserErrorRateLimiter limiter,ObjectProvider<OperationalEventSink> events){
        var service=new BrowserErrorService(source,clock,properties,limiter,events);service.verifySchema();return service;
    }
    @Bean @ConditionalOnMissingBean(name="scBrowserErrorBodyFilter")
    FilterRegistrationBean<BrowserErrorBodyFilter> scBrowserErrorBodyFilter(ScBrowserErrorsProperties properties,ObjectMapper mapper,BrowserErrorService service){
        var registration=new FilterRegistrationBean<>(new BrowserErrorBodyFilter(properties,mapper,service));
        registration.addUrlPatterns("/api/operations/browser-errors");registration.setOrder(0);return registration;
    }
}
