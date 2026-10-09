package dev.scframework.core.storage;

/*
 * 바이너리 쓰기의 결과로 내부 파일 경로 대신 opaque key와 실제 저장 바이트 수만 돌려준다.
 * 앱은 이 key를 metadata에 연결하고 다운로드 전에 자기 업무 권한을 검사한다.
 */

/** 외부에 파일 시스템 경로나 원문을 공개하지 않는다. */
public record StoredBlob(String key, long size) {}
