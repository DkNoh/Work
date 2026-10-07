package dev.scframework.autoconfigure.storage;

import dev.scframework.core.storage.FileStorage;
import dev.scframework.core.storage.RecoverableFileStorage;
import dev.scframework.core.messaging.DurableMessagePublisher;
import dev.scframework.core.messaging.ScMessage;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** DB 결과를 이미 commit한 뒤 저장소 정리 실패로 HTTP 결과를 바꾸지 않는다. */
public class FileStorageTransactions {
    private static final Logger LOG = LoggerFactory.getLogger(FileStorageTransactions.class);
    private final FileStorage storage;
    private final AtomicLong cleanupFailures = new AtomicLong();
    private final org.springframework.beans.factory.ObjectProvider<DurableMessagePublisher> publisher;
    private final org.springframework.beans.factory.ObjectProvider<org.springframework.transaction.PlatformTransactionManager> manager;
    private final boolean durable;
    public FileStorageTransactions(FileStorage storage) { this(storage,null,null,false); }
    public FileStorageTransactions(FileStorage storage,org.springframework.beans.factory.ObjectProvider<DurableMessagePublisher> publisher,org.springframework.beans.factory.ObjectProvider<org.springframework.transaction.PlatformTransactionManager> manager,boolean durable){this.storage=storage;this.publisher=publisher;this.manager=manager;this.durable=durable;}
    public void onRollback(String key) {
        requireTransaction();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) { if (status != STATUS_COMMITTED) cleanup(key);else if(storage instanceof RecoverableFileStorage recovery){try{recovery.markRetained(key);}catch(IOException failure){failed();}} }
        });
    }
    public void afterCommitDelete(String key) {
        requireTransaction();
        if(durable){enqueue(key);return;}
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { cleanup(key); }
        });
    }
    public void cleanup(String key) {
        if(durable){try{org.springframework.transaction.support.TransactionTemplate writer=new org.springframework.transaction.support.TransactionTemplate(manager.getObject());writer.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);writer.executeWithoutResult(ignored->enqueue(key));}catch(RuntimeException failure){failed();}return;}
        try { storage.delete(key); }
        catch (IOException | RuntimeException exception) {
            failed();
        }
    }
    private void enqueue(String key){if(key==null||!key.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))throw new IllegalArgumentException("SC_STORAGE_KEY_INVALID");publisher.getObject().enqueue(new ScMessage(java.util.UUID.randomUUID(),"FILE_DELETE",1,java.time.Instant.now(),"{\"key\":\""+key+"\"}"));}
    private void failed(){cleanupFailures.incrementAndGet();LOG.warn("File storage cleanup failed; operational counter incremented");}
    public long cleanupFailures() { return cleanupFailures.get(); }
    private void requireTransaction() {
        if (!TransactionSynchronizationManager.isActualTransactionActive() || !TransactionSynchronizationManager.isSynchronizationActive()) throw new IllegalStateException("File lifecycle requires an active transaction");
    }
}
