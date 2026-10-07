package dev.scframework.core.storage;

/** 외부에 파일 시스템 경로나 원문을 공개하지 않는다. */
public record StoredBlob(String key, long size) {}
