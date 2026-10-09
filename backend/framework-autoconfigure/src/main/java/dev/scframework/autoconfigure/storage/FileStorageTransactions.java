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

/*
 * DB metadata 변경과 파일 시스템의 서로 다른 커밋 경계를 연결한다. 파일은 DB rollback으로 저절로 복구되지 않는다.
 * 새 파일은 rollback 시 정리하고 기존 파일 삭제는 커밋 뒤 수행한다. durable 모드는 outbox에 삭제 의도를 기록한다.
 * 정리 실패는 counter로 남겨 완료된 HTTP 결과를 뒤집지 않으며 호출에는 활성 TX/synchronization이 필요하다.
 */

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
    // 새 blob을 만든 업무는 이 메서드를 등록한다. rollback이면 blob을 정리하고 commit이면 pending marker만 확정 제거한다.
    public void onRollback(String key) {
        requireTransaction();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) { if (status != STATUS_COMMITTED) cleanup(key);else if(storage instanceof RecoverableFileStorage recovery){try{recovery.markRetained(key);}catch(IOException failure){failed();}} }
        });
    }
    // 기존 blob 삭제는 metadata 제거의 commit에 종속된다. durable 모드는 같은 TX의 삭제 메시지로 crash 경계를 잇는다.
    public void afterCommitDelete(String key) {
        requireTransaction();
        if(durable){enqueue(key);return;}
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { cleanup(key); }
        });
    }
    // durable일 때 새 TX로 삭제 의도를 기록한다. 일반 모드는 즉시 파일 삭제하며 실패는 완료된 업무 결과와 분리한다.
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
