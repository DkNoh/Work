package dev.scframework.core.messaging;

/** 호출자의 활성 DB transaction에 기록한다. 여기서 broker 연결을 하지 않는다. */
public interface DurableMessagePublisher { void enqueue(ScMessage message); }
