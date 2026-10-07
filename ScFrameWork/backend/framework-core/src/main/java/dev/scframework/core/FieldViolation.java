package dev.scframework.core;

/** 프런트의 ApiError.fields에 연결하는 필드 오류 계약. */
public record FieldViolation(String field, String message) {}
