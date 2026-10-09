package dev.scframework.autoconfigure.messaging;

import dev.scframework.autoconfigure.storage.FileRecoveryService;
import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.scheduling.ScheduledRunContext;
import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;

/*
 * 기존 outbox 발행/파일 복구 기능을 Quartz 등록 작업 SPI로 연결하는 어댑터다.
 * 두 작업은 내부에서 짧은 TX를 관리하므로 NON_TRANSACTIONAL을 명시해 외부 호출 동안 큰 TX를 유지하지 않는다.
 */

public final class MessageOperationalTasks {
    private MessageOperationalTasks(){}
    public static RegisteredOperationalTask outbox(ObjectProvider<MessageDispatcher> dispatcher){return new RegisteredOperationalTask(){public String jobCode(){return "OUTBOX_DISPATCH";}public ExecutionMode executionMode(){return ExecutionMode.NON_TRANSACTIONAL;}public void execute(ScheduledRunContext context){dispatcher.getObject().dispatch();}};}
    public static RegisteredOperationalTask files(ObjectProvider<FileRecoveryService> recovery){return new RegisteredOperationalTask(){public String jobCode(){return "FILE_RECOVERY";}public ExecutionMode executionMode(){return ExecutionMode.NON_TRANSACTIONAL;}public void execute(ScheduledRunContext context){recovery.getObject().recover();}};}
    // SAFE_RETENTION은 Tokens의 합성 task가 메시지/브라우저/실행 이력을 한 TX에서 정리한다.
    public static int retain(JdbcMessageStore store,Clock clock,ScMessagingProperties props){return store.retain(clock.instant().minus(java.time.Duration.ofDays(props.getRetentionDays())));}
}
