package dev.scframework.core;

import java.util.List;

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
