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

/*
 * 서버의 외부 HTTP client에 공통 호출 경계, 재시도 없음, 요청 추적 헤더를 제공한다.
 * 브라우저용 runtime client와는 다른 계층이며 client 목록/URL/timeout은 소비 앱에서 명시한다.
 * MDC의 검증된 요청 ID만 전달하고 수신 사용자 cookie/인증/CSRF는 복사하지 않는다.
 */

@AutoConfiguration
@ConditionalOnClass(RequestInterceptor.class)
public class ScFeignAutoConfiguration {
    @Bean @ConditionalOnMissingBean(FeignCallBoundary.class)
    FeignCallBoundary scFeignCallBoundary() { return new FeignCallBoundary(); }

    @Bean @ConditionalOnMissingBean(Retryer.class)
    // 쓰기 외부 요청이 암묵적으로 중복 실행되지 않도록 Feign 기본 자동 재시도를 끈다.
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
