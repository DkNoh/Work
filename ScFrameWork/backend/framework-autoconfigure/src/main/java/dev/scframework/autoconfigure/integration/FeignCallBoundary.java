package dev.scframework.autoconfigure.integration;

import dev.scframework.core.ApiException;
import feign.FeignException;
import feign.RetryableException;
import java.util.function.Supplier;

/** 외부 응답 본문·URL·예외 message를 공통 API 오류와 로그에 노출하지 않는다. */
public class FeignCallBoundary {
    public <T> T call(Supplier<T> request) {
        try {
            return request.get();
        } catch (RetryableException exception) {
            throw new ApiException(504, "UPSTREAM_TIMEOUT", "외부 서비스에 연결할 수 없습니다.");
        } catch (FeignException exception) {
            throw new ApiException(502, "UPSTREAM_FAILURE", "외부 서비스 요청이 실패했습니다.");
        }
    }
}
