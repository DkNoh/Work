package dev.scframework.core;

import java.util.List;

/*
 * 오류 응답 JSON의 공통 DTO다. 성공 응답은 이 형태로 감싸지 않는다.
 * record는 생성자/접근자를 제공하며 errors를 복사해 호출자가 원본 리스트를 바꿔도 응답 계약이 바뀌지 않게 한다.
 * of는 필드 오류가 없는 일반 실패를 만들고, 필드 오류는 프런트 runtime의 ApiError.fields로 연결된다.
 */

public record ApiError(String code, String message, List<FieldViolation> errors) {
    public ApiError {
        errors = errors == null ? List.of() : List.copyOf(errors);
    }

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, List.of());
    }
}
