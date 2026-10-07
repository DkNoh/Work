package dev.scframework.core;

import java.util.List;

public record ApiError(String code, String message, List<FieldViolation> errors) {
    public ApiError {
        errors = errors == null ? List.of() : List.copyOf(errors);
    }

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, List.of());
    }
}
