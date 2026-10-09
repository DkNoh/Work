package dev.scframework.autoconfigure.messaging;

import dev.scframework.core.messaging.DurableMessagePublisher;
import dev.scframework.core.messaging.ScMessage;

/*
 * DurableMessagePublisher SPI의 기본 구현이다. 등록 payload를 먼저 검사한 뒤 outbox 저장소에 기록한다.
 * enqueue에서 Rabbit을 호출하지 않으며 현재 업무 TX가 없으면 저장소가 거절한다.
 */

public final class JdbcDurableMessagePublisher implements DurableMessagePublisher {
    private final JdbcMessageStore store;
    private final MessageRegistry registry;
    public JdbcDurableMessagePublisher(JdbcMessageStore store, MessageRegistry registry){this.store=store;this.registry=registry;}
    @Override public void enqueue(ScMessage message){registry.require(message);store.enqueue(message);}
}
