package dev.scframework.core.operations;

/*
 * 운영 이벤트를 지표/정제 로그로 보내는 SPI다. 감사 저장 계약과는 별도의 관측 경계다.
 * 관측 실패를 원 업무 실패로 바꾸지 않도록 구현과 호출 어댑터가 best effort로 다룬다.
 */

/** 호출자는 관측 실패가 업무 결과를 바꾸지 않도록 이 SPI를 best effort로 구현한다. */
@FunctionalInterface
public interface OperationalEventSink {
    void record(OperationalEvent event);
}
