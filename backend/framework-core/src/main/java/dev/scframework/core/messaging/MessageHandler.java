package dev.scframework.core.messaging;

/*
 * type은 등록 코드, validate는 본문 검사, handle은 실제 효과를 수행하는 확장 계약이다.
 * validate에서는 저장/외부 호출을 하지 않는다. handle은 소비기의 inbox 기록과 같은 DB 트랜잭션에 참여한다.
 * 재전달 가능성을 고려해야 하며 임의 클래스명이나 사용자 제공 실행 코드를 해석하지 않는다.
 */

/** 등록 type만 허용한다. validate는 side effect가 없고 handle은 inbox와 같은 DB TX다. */
public interface MessageHandler {
    String type();
    void validate(String payload);
    void handle(ScMessage message) throws Exception;
}
