package dev.scframework.autoconfigure.messaging;

import dev.scframework.core.messaging.DurableMessagePublisher;
import dev.scframework.core.messaging.ScMessage;

public final class JdbcDurableMessagePublisher implements DurableMessagePublisher {
    private final JdbcMessageStore store;
    private final MessageRegistry registry;
    public JdbcDurableMessagePublisher(JdbcMessageStore store, MessageRegistry registry){this.store=store;this.registry=registry;}
    @Override public void enqueue(ScMessage message){registry.require(message);store.enqueue(message);}
}
