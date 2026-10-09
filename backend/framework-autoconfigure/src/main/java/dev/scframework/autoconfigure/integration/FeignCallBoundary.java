package dev.scframework.autoconfigure.integration;

import dev.scframework.core.ApiException;
import feign.FeignException;
import feign.RetryableException;
import java.util.function.Supplier;

/*
 * Supplier로 전달받은 외부 Feign 호출의 성공값을 같은 T 타입으로 반환하는 오류 경계다.
 * RetryableException은 504, 그 밖의 FeignException은 502의 공통 API 오류로 바꾼다.
 * 외부 오류 본문/URL/예외 메시지를 소비 앱 응답으로 그대로 전달하지 않는다.
 */

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
