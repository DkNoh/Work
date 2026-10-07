package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.*;
import dev.scframework.autoconfigure.browsererrors.*;
import dev.scframework.core.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import com.fasterxml.jackson.databind.ObjectMapper;

class BrowserErrorBoundaryTest {
    @Test void boundedGlobalAndActorWindowsResetWithoutRetainingArbitrarySubjects(){
        var time=new AtomicReference<>(Instant.parse("2026-10-07T00:00:00Z"));
        Clock clock=new Clock(){public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId value){return this;}public Instant instant(){return time.get();}};
        var properties=new ScBrowserErrorsProperties();properties.setActorPerMinute(2);properties.setGlobalPerMinute(3);properties.validate();
        var limiter=new BrowserErrorRateLimiter(clock,properties);
        limiter.acquire("actor-a");limiter.acquire("actor-a");assertThatThrownBy(()->limiter.acquire("actor-a")).isInstanceOf(ApiException.class).satisfies(error->assertThat(((ApiException)error).status()).isEqualTo(429));
        limiter.acquire("actor-b");assertThatThrownBy(()->limiter.acquire("actor-c")).isInstanceOf(ApiException.class);
        assertThat(limiter.retryAfterSeconds()).isEqualTo(60);time.set(time.get().plusSeconds(60));limiter.acquire("actor-a");limiter.acquire("actor-c");
    }
    @Test void consumerVersionIsConfiguredRatherThanFrameworkCohort(){
        var properties=new ScBrowserErrorsProperties();properties.setAppVersion("12.3.4-rc.1+build.5");assertThatCode(properties::validate).doesNotThrowAnyException();
        for(String invalid:new String[]{"private value?token=canary","01.2.3","1.2.3-01","1.2.3-a..b","1.2.3+build..5"}){properties.setAppVersion(invalid);assertThatThrownBy(properties::validate).hasMessage("Invalid browser error configuration");}
    }
    @Test void bodyWithoutContentLengthCannotBypassLimit()throws Exception{
        var properties=new ScBrowserErrorsProperties();var service=org.mockito.Mockito.mock(BrowserErrorService.class);
        var filter=new BrowserErrorBodyFilter(properties,new ObjectMapper(),service);
        var request=new MockHttpServletRequest(){@Override public int getContentLength(){return -1;}@Override public long getContentLengthLong(){return -1;}};
        request.setMethod("POST");request.setRequestURI("/api/operations/browser-errors");request.setContentType("application/json");request.setContent(new byte[4097]);
        var response=new MockHttpServletResponse();filter.doFilter(request,response,(req,res)->{throw new AssertionError("Overlarge input reached handler");});
        assertThat(response.getStatus()).isEqualTo(413);assertThat(response.getContentAsString()).contains("REPORT_TOO_LARGE");org.mockito.Mockito.verify(service).rejected();
    }
    @Test void rawFieldsDuplicateKeysAndFloatVersionAreRejectedBeforeBinding()throws Exception{
        for(String body:new String[]{"{\"schemaVersion\":1,\"message\":\"PRIVATE_CANARY\"}","{\"schemaVersion\":1,\"schemaVersion\":1}","{\"schemaVersion\":1.5}","{\"schemaVersion\":1,\"clientEventId\":\"00000000-0000-4000-8000-000000000000\",\"source\":\"VUE\",\"eventCode\":\"VUE_ERROR\",\"appVersion\":\"0.1.0\",\"routeCode\":\"examples\",\"componentCode\":\"ROOT\"}{}"}){
            var service=org.mockito.Mockito.mock(BrowserErrorService.class);var filter=new BrowserErrorBodyFilter(new ScBrowserErrorsProperties(),new ObjectMapper(),service);
            var request=new MockHttpServletRequest("POST","/api/operations/browser-errors");request.setContentType("application/json");request.setContent(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            var response=new MockHttpServletResponse();filter.doFilter(request,response,(req,res)->{throw new AssertionError("Unsafe raw input reached handler");});
            assertThat(response.getStatus()).isEqualTo(400);assertThat(response.getContentAsString()).doesNotContain("PRIVATE_CANARY");
        }
    }
}
