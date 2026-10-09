package dev.scframework.core.scheduling;

/*
 * Quartz가 실행할 수 있도록 앱이 미리 등록하는 작업의 계약이다. jobCode가 등록 키다.
 * 기본 TRANSACTIONAL은 효과와 성공 이력을 같은 트랜잭션으로 묶는다. 네트워크 작업은 NON_TRANSACTIONAL을 명시한다.
 * execute의 context는 예약 식별/예정 시각/시도 횟수이며 사용자가 보낸 임의 실행 payload가 아니다.
 */

/** 소비 앱이 등록한 운영 작업만 실행한다. 실행 payload나 임의 클래스 이름은 받지 않는다. */
public interface RegisteredOperationalTask {
    String jobCode();
    default ExecutionMode executionMode() { return ExecutionMode.TRANSACTIONAL; }
    void execute(ScheduledRunContext context) throws Exception;
    enum ExecutionMode { TRANSACTIONAL, NON_TRANSACTIONAL }
}
