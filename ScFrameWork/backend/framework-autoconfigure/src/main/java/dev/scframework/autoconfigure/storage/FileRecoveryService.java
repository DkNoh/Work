package dev.scframework.autoconfigure.storage;

import dev.scframework.core.messaging.DurableMessagePublisher;
import dev.scframework.core.messaging.ScMessage;
import dev.scframework.core.operations.OperationalEvent;
import dev.scframework.core.operations.OperationalEventSink;
import dev.scframework.core.storage.FileReferenceLookup;
import dev.scframework.core.storage.RecoverableFileStorage;
import java.time.Clock;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

public final class FileRecoveryService {
    private final RecoverableFileStorage storage;private final ObjectProvider<FileReferenceLookup> references;private final DurableMessagePublisher publisher;private final Clock clock;
    private final TransactionTemplate fresh,outside;private final ObjectProvider<OperationalEventSink> sinks;
    public FileRecoveryService(RecoverableFileStorage storage,ObjectProvider<FileReferenceLookup> references,DurableMessagePublisher publisher,Clock clock,PlatformTransactionManager manager,ObjectProvider<OperationalEventSink> sinks){
        this.storage=storage;this.references=references;this.publisher=publisher;this.clock=clock;this.sinks=sinks;
        fresh=new TransactionTemplate(manager);fresh.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);outside=new TransactionTemplate(manager);outside.setPropagationBehavior(TransactionDefinition.PROPAGATION_NOT_SUPPORTED);
    }
    public void recover(){outside.executeWithoutResult(ignored->{
        try{
            int count=0;
            for(RecoverableFileStorage.PendingWrite pending:storage.pendingWrites()){
                if(pending.currentRun())continue;if(++count>100)break;
                fresh.executeWithoutResult(status->{if(!references.getObject().isReferenced(pending.key()))publisher.enqueue(new ScMessage(UUID.randomUUID(),"FILE_DELETE",1,clock.instant(),"{\"key\":\""+pending.key()+"\"}"));});
                // enqueue commit 뒤 marker 제거: 중간 crash는 중복 FILE_DELETE이며 inbox/idempotent delete로 안전하다.
                storage.markRetained(pending.key());
            }
            event(OperationalEvent.Outcome.SUCCESS);
        }catch(java.io.IOException|RuntimeException failure){event(OperationalEvent.Outcome.FAILURE);throw new IllegalStateException("SC_FILE_RECOVERY_FAILED");}
    });}
    private void event(OperationalEvent.Outcome outcome){try{OperationalEventSink sink=sinks.getIfAvailable();if(sink!=null)sink.record(new OperationalEvent(OperationalEvent.Kind.FILE_RECOVERY,outcome,null));}catch(RuntimeException ignored){}}
}
