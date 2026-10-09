package dev.scframework.core.messaging;

/*
 * 업무 트랜잭션 안에 outbox 메시지를 기록하는 SPI다. enqueue 완료는 broker 전달 완료를 뜻하지 않는다.
 * 별도 dispatcher가 커밋된 레코드를 전송하므로 업무 변경과 발행 의도를 같은 DB 트랜잭션으로 묶을 수 있다.
 */

/** 호출자의 활성 DB transaction에 기록한다. 여기서 broker 연결을 하지 않는다. */
public interface DurableMessagePublisher { void enqueue(ScMessage message); }
