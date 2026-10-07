package dev.scframework.core.storage;

/** 앱 metadata에 commit된 파일 연결만 확인한다. 공통은 업무 table을 알지 못한다. */
public interface FileReferenceLookup { boolean isReferenced(String key); }
