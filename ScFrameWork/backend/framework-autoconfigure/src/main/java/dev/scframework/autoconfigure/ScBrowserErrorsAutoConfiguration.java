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

/*
 * browser-errors.enabled일 때만 크기 제한 필터·빈도 제한기·JDBC 수집 서비스를 만든다.
 * 서비스 생성 시 앱 migration 완료 여부를 검사하며 dev OpenAPI에서는 schemaVersion의 실제 숫자 계약을 보정한다.
 * FilterRegistrationBean은 지정 POST 경로의 본문 경계를 Servlet 필터에 연결한다.
 */

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
    // ObjectProvider는 관측 sink가 없는 기본 실행도 허용한다. verifySchema는 필수 앱 migration 누락을 기동 시 발견한다.
    BrowserErrorService scBrowserErrorService(DataSource source,Clock clock,ScBrowserErrorsProperties properties,BrowserErrorRateLimiter limiter,ObjectProvider<OperationalEventSink> events){
        var service=new BrowserErrorService(source,clock,properties,limiter,events);service.verifySchema();return service;
    }
    @Bean @ConditionalOnMissingBean(name="scBrowserErrorBodyFilter")
    // 본문을 읽는 필터는 이 단일 경로에만 연결한다. 다른 업무 JSON의 파싱 계약을 변경하지 않는다.
    FilterRegistrationBean<BrowserErrorBodyFilter> scBrowserErrorBodyFilter(ScBrowserErrorsProperties properties,ObjectMapper mapper,BrowserErrorService service){
        var registration=new FilterRegistrationBean<>(new BrowserErrorBodyFilter(properties,mapper,service));
        registration.addUrlPatterns("/api/operations/browser-errors");registration.setOrder(0);return registration;
    }
}
