package dev.scframework.autoconfigure;

import dev.scframework.autoconfigure.web.ApiExceptionHandler;
import dev.scframework.autoconfigure.audit.RequestAuditRecorder;
import dev.scframework.autoconfigure.web.CommonEndpoints;
import dev.scframework.autoconfigure.web.FrameworkCapabilityEndpoints;
import dev.scframework.autoconfigure.web.DefaultSessionEndpoints;
import dev.scframework.autoconfigure.web.RequestIdFilter;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.core.env.Environment;

/*
 * Servlet 앱에 상태/CSRF/선택 기능 endpoint, 공통 오류 Advice, request ID 필터를 등록한다.
 * DefaultSessionEndpoints는 설정으로 끌 수 있으며 앱별 사용자 DTO를 대신 구현할 수 있다.
 * 조건부 bean으로 소비 앱의 구현을 존중하며 업무 Controller나 앱 클래스를 import하지 않는다.
 */

@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableConfigurationProperties(ScFrameworkProperties.class)
public class ScWebAutoConfiguration {
    @Bean @ConditionalOnMissingBean
    FrameworkCapabilityEndpoints scFrameworkCapabilityEndpoints(Environment environment) {
        return new FrameworkCapabilityEndpoints(environment);
    }

    @Bean @ConditionalOnMissingBean
    CommonEndpoints scCommonEndpoints(ScFrameworkProperties properties, ObjectProvider<ApplicationAvailability> availability) {
        return new CommonEndpoints(properties, availability.getIfAvailable());
    }

    @Bean @ConditionalOnMissingBean(DefaultSessionEndpoints.class)
    @ConditionalOnProperty(prefix = "sc.framework.session-endpoint", name = "enabled", havingValue = "true", matchIfMissing = true)
    DefaultSessionEndpoints scDefaultSessionEndpoints() { return new DefaultSessionEndpoints(); }

    @Bean @ConditionalOnMissingBean
    ApiExceptionHandler scApiExceptionHandler(ObjectProvider<RequestAuditRecorder> audit) {
        return new ApiExceptionHandler(audit.getIfAvailable());
    }

    @Bean @ConditionalOnMissingBean(name = "scRequestIdFilter")
    FilterRegistrationBean<RequestIdFilter> scRequestIdFilter() {
        FilterRegistrationBean<RequestIdFilter> registration = new FilterRegistrationBean<>(new RequestIdFilter());
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        return registration;
    }
}
