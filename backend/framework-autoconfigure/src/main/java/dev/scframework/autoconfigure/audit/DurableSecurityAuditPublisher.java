package dev.scframework.autoconfigure.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditPublisher;
import dev.scframework.core.messaging.DurableMessagePublisher;
import dev.scframework.core.messaging.ScMessage;
import java.util.UUID;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/*
 * 성공 감사는 현재 업무 TX의 outbox에 넣어 업무와 발행 의도를 원자적으로 커밋한다.
 * 실패/인증 감사는 새 트랜잭션에서 기록하고 오류를 diagnostics로 제한해 이미 정해진 HTTP 결과를 보존한다.
 */

/** 성공 감사 outbox는 업무 TX와 원자적이다. 인증/실패 감사는 새 TX, 응답에 sink 장애를 전달하지 않는다. */
public final class DurableSecurityAuditPublisher implements SecurityAuditPublisher {
    private final DurableMessagePublisher publisher;private final ObjectMapper mapper;private final AuditWriteDiagnostics diagnostics;private final TransactionTemplate fresh;
    public DurableSecurityAuditPublisher(DurableMessagePublisher publisher,ObjectMapper mapper,PlatformTransactionManager manager,AuditWriteDiagnostics diagnostics){this.publisher=publisher;this.mapper=mapper;this.diagnostics=diagnostics;fresh=new TransactionTemplate(manager);fresh.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);}
    // 활성 TX의 SUCCESS는 enqueue를 즉시 호출해 rollback도 함께 되게 한다. 그 밖의 감사는 완료 후/즉시 새 TX로 분리한다.
    @Override public void publish(SecurityAuditEvent event){
        ScMessage message;try{message=new ScMessage(UUID.randomUUID(),"SECURITY_AUDIT",1,event.occurredAt(),mapper.writeValueAsString(event));}catch(java.io.IOException exception){throw new IllegalArgumentException("SC_AUDIT_ENCODING_INVALID");}
        if(TransactionSynchronizationManager.isActualTransactionActive()&&TransactionSynchronizationManager.isSynchronizationActive()){
            if("SUCCESS".equals(event.outcome()))publisher.enqueue(message);
            else TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCompletion(int status){safe(message);}});
        }else safe(message);
    }
    // REQUIRES_NEW outbox 기록 실패는 diagnostics로 제한한다. 성공 업무 TX의 enqueue 실패와 다른 처리 경계다.
    private void safe(ScMessage message){try{fresh.executeWithoutResult(ignored->publisher.enqueue(message));}catch(RuntimeException failure){diagnostics.failed();}}
}
