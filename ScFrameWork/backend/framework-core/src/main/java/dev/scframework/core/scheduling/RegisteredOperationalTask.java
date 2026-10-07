package dev.scframework.core.scheduling;

/** 소비 앱이 등록한 운영 작업만 실행한다. 실행 payload나 임의 클래스 이름은 받지 않는다. */
public interface RegisteredOperationalTask {
    String jobCode();
    default ExecutionMode executionMode() { return ExecutionMode.TRANSACTIONAL; }
    void execute(ScheduledRunContext context) throws Exception;
    enum ExecutionMode { TRANSACTIONAL, NON_TRANSACTIONAL }
}
