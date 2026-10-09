package dev.scframework.core.storage;

/*
 * 파일 키가 앱 DB의 커밋된 metadata에서 아직 참조되는지 묻는 SPI다.
 * 공통 복구/삭제 코드는 업무 테이블을 직접 조회하지 않고 앱이 제공한 이 판단을 소비한다.
 */

/** 앱 metadata에 commit된 파일 연결만 확인한다. 공통은 업무 table을 알지 못한다. */
public interface FileReferenceLookup { boolean isReferenced(String key); }
