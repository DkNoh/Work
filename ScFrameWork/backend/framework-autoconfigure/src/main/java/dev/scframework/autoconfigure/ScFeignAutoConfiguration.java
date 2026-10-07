package dev.scframework.autoconfigure;

import dev.scframework.autoconfigure.web.RequestIdFilter;
import dev.scframework.autoconfigure.integration.FeignCallBoundary;
import feign.RequestInterceptor;
import feign.Retryer;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@ConditionalOnClass(RequestInterceptor.class)
public class ScFeignAutoConfiguration {
    @Bean @ConditionalOnMissingBean(FeignCallBoundary.class)
    FeignCallBoundary scFeignCallBoundary() { return new FeignCallBoundary(); }

    @Bean @ConditionalOnMissingBean(Retryer.class)
    Retryer scFeignRetryer() { return Retryer.NEVER_RETRY; }

    @Bean @ConditionalOnMissingBean(name = "scFeignRequestIdInterceptor")
    RequestInterceptor scFeignRequestIdInterceptor() {
        return template -> {
            String requestId = MDC.get(RequestIdFilter.MDC_KEY);
            if (requestId != null) template.header(RequestIdFilter.HEADER, requestId);
            // 수신 Cookie/Authorization/CSRF는 자동으로 외부에 전달하지 않는다.
        };
    }
}
