package dev.scframework.autoconfigure.messaging;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.context.SmartLifecycle;

public final class MessageWorker implements SmartLifecycle {
    private final MessageDispatcher dispatcher;private final ScMessagingProperties props;private final MessageDiagnostics diagnostics;
    private volatile ScheduledExecutorService executor;
    private final org.springframework.beans.factory.ObjectProvider<dev.scframework.autoconfigure.storage.FileRecoveryService> recovery;
    public MessageWorker(MessageDispatcher dispatcher,ScMessagingProperties props,MessageDiagnostics diagnostics,org.springframework.beans.factory.ObjectProvider<dev.scframework.autoconfigure.storage.FileRecoveryService> recovery){this.dispatcher=dispatcher;this.props=props;this.diagnostics=diagnostics;this.recovery=recovery;}
    @Override public synchronized void start(){if(isRunning())return;executor=Executors.newSingleThreadScheduledExecutor(r->{Thread thread=new Thread(r,"sc-message-dispatch");thread.setDaemon(true);return thread;});executor.scheduleWithFixedDelay(()->{try{dev.scframework.autoconfigure.storage.FileRecoveryService service=recovery.getIfAvailable();if(service!=null)service.recover();dispatcher.dispatch();}catch(RuntimeException failure){diagnostics.failed();}},0,props.getPollInterval().toMillis(),TimeUnit.MILLISECONDS);}
    @Override public synchronized void stop(){ScheduledExecutorService current=executor;executor=null;if(current!=null){current.shutdownNow();try{current.awaitTermination(10,TimeUnit.SECONDS);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();}}}
    @Override public boolean isRunning(){return executor!=null&&!executor.isShutdown();}
    @Override public int getPhase(){return Integer.MAX_VALUE-100;}
}
