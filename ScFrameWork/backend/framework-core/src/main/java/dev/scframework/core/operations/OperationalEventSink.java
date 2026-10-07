package dev.scframework.core.operations;

/** 호출자는 관측 실패가 업무 결과를 바꾸지 않도록 이 SPI를 best effort로 구현한다. */
@FunctionalInterface
public interface OperationalEventSink {
    void record(OperationalEvent event);
}
