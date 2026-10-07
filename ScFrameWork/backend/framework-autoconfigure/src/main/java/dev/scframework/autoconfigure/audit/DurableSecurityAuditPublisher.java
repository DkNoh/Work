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

/** 성공 감사 outbox는 업무 TX와 원자적이다. 인증/실패 감사는 새 TX, 응답에 sink 장애를 전달하지 않는다. */
public final class DurableSecurityAuditPublisher implements SecurityAuditPublisher {
    private final DurableMessagePublisher publisher;private final ObjectMapper mapper;private final AuditWriteDiagnostics diagnostics;private final TransactionTemplate fresh;
    public DurableSecurityAuditPublisher(DurableMessagePublisher publisher,ObjectMapper mapper,PlatformTransactionManager manager,AuditWriteDiagnostics diagnostics){this.publisher=publisher;this.mapper=mapper;this.diagnostics=diagnostics;fresh=new TransactionTemplate(manager);fresh.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);}
    @Override public void publish(SecurityAuditEvent event){
        ScMessage message;try{message=new ScMessage(UUID.randomUUID(),"SECURITY_AUDIT",1,event.occurredAt(),mapper.writeValueAsString(event));}catch(java.io.IOException exception){throw new IllegalArgumentException("SC_AUDIT_ENCODING_INVALID");}
        if(TransactionSynchronizationManager.isActualTransactionActive()&&TransactionSynchronizationManager.isSynchronizationActive()){
            if("SUCCESS".equals(event.outcome()))publisher.enqueue(message);
            else TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCompletion(int status){safe(message);}});
        }else safe(message);
    }
    private void safe(ScMessage message){try{fresh.executeWithoutResult(ignored->publisher.enqueue(message));}catch(RuntimeException failure){diagnostics.failed();}}
}
