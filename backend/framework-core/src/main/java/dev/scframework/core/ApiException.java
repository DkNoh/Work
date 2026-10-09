package dev.scframework.core;

import java.util.List;

/*
 * Service에서 HTTP 라이브러리 의존 없이 오류 상태와 공개 메시지를 전달하는 예외다.
 * 400~599 상태만 허용하며 web의 ApiExceptionHandler가 error()를 응답 본문으로 변환한다.
 * 이 예외를 던지는 것은 실패를 호출자에게 전달하는 것이며 DB 트랜잭션 경계는 Service가 결정한다.
 */

/** HTTP 구현에 의존하지 않는 업무 오류. status에는 유효한 HTTP 오류 상태만 사용한다. */
public final class ApiException extends RuntimeException {
    private final int status;
    private final ApiError error;

    public ApiException(int status, String code, String message) {
        this(status, code, message, List.of());
    }

    public ApiException(int status, String code, String message, List<FieldViolation> errors) {
        super(message);
        if (status < 400 || status > 599) throw new IllegalArgumentException("Invalid error status");
        this.status = status;
        this.error = new ApiError(code, message, errors);
    }

    public int status() { return status; }
    public ApiError error() { return error; }
}
