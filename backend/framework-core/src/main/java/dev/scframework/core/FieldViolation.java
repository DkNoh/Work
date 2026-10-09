package dev.scframework.core;

/*
 * 필드 하나의 검증 실패를 field/message로 표현하는 불변 값이다.
 * field는 입력 DTO의 이름과 맞춰야 프런트 폼이 해당 입력 아래에 메시지를 표시할 수 있다.
 */

/** 프런트의 ApiError.fields에 연결하는 필드 오류 계약. */
public record FieldViolation(String field, String message) {}
