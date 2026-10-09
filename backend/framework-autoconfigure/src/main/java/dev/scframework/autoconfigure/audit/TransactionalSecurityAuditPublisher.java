package dev.scframework.autoconfigure.audit;

import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditPublisher;
import dev.scframework.core.audit.SecurityAuditSink;
import java.util.Objects;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/*
 * 일반 감사 모드에서 업무 트랜잭션 완료 후 새 트랜잭션으로 sink에 저장한다.
 * rollback된 SUCCESS는 생략하고 실패 이벤트는 별도 기록한다. 저장 실패는 diagnostics로 제한한다.
 * afterCompletion 기반이므로 프로세스 crash에도 전달을 보장하는 durable outbox와 동일한 보장은 아니다.
 */

/** 업무 완료 뒤 별도 트랜잭션으로 기록하며 감사 실패로 완료된 업무 응답을 바꾸지 않는다. */
public final class TransactionalSecurityAuditPublisher implements SecurityAuditPublisher {
    private final SecurityAuditSink sink;
    private final AuditWriteDiagnostics diagnostics;
    private final TransactionTemplate writer;

    public TransactionalSecurityAuditPublisher(SecurityAuditSink sink,
            PlatformTransactionManager transactionManager, AuditWriteDiagnostics diagnostics) {
        this.sink = Objects.requireNonNull(sink);
        this.diagnostics = Objects.requireNonNull(diagnostics);
        writer = new TransactionTemplate(transactionManager);
        writer.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        writer.setTimeout(5);
    }

    @Override
    // 트랜잭션이 있으면 afterCompletion을 등록한다. 성공 감사는 STATUS_COMMITTED일 때만 남겨 rollback을 성공으로 오인하지 않는다.
    public void publish(SecurityAuditEvent event) {
        Objects.requireNonNull(event);
        if (TransactionSynchronizationManager.isActualTransactionActive()
                && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCompletion(int status) {
                    // rollback된 명령은 성공 감사로 기록하지 않는다. 오류 응답의 실패 감사는 별도 경계다.
                    if (!"SUCCESS".equals(event.outcome()) || status == STATUS_COMMITTED) save(event);
                }
            });
        } else save(event);
    }

    // REQUIRES_NEW와 5초 timeout으로 감사 저장을 분리하며 sink 실패를 원 업무 응답에 전파하지 않는다.
    private void save(SecurityAuditEvent event) {
        try {
            writer.executeWithoutResult(status -> sink.save(event));
        } catch (RuntimeException exception) {
            diagnostics.failed();
        }
    }
}
