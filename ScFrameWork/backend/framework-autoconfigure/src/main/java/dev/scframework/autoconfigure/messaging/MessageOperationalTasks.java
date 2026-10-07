package dev.scframework.autoconfigure.messaging;

import dev.scframework.autoconfigure.storage.FileRecoveryService;
import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.scheduling.ScheduledRunContext;
import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;

public final class MessageOperationalTasks {
    private MessageOperationalTasks(){}
    public static RegisteredOperationalTask outbox(ObjectProvider<MessageDispatcher> dispatcher){return new RegisteredOperationalTask(){public String jobCode(){return "OUTBOX_DISPATCH";}public ExecutionMode executionMode(){return ExecutionMode.NON_TRANSACTIONAL;}public void execute(ScheduledRunContext context){dispatcher.getObject().dispatch();}};}
    public static RegisteredOperationalTask files(ObjectProvider<FileRecoveryService> recovery){return new RegisteredOperationalTask(){public String jobCode(){return "FILE_RECOVERY";}public ExecutionMode executionMode(){return ExecutionMode.NON_TRANSACTIONAL;}public void execute(ScheduledRunContext context){recovery.getObject().recover();}};}
    // SAFE_RETENTION은 Tokens의 합성 task가 메시지/브라우저/실행 이력을 한 TX에서 정리한다.
    public static int retain(JdbcMessageStore store,Clock clock,ScMessagingProperties props){return store.retain(clock.instant().minus(java.time.Duration.ofDays(props.getRetentionDays())));}
}
