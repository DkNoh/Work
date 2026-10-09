package dev.scframework.autoconfigure.messaging;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.context.SmartLifecycle;

/*
 * Spring SmartLifecycle에 따라 단일 스레드 폴링을 시작/종료하는 outbox 작업자다.
 * 한 회차에 선택 파일 복구 후 발행을 실행하며 실패는 진단 후 다음 주기로 넘긴다.
 * stop은 executor를 분리하고 interrupt/종료 대기를 수행해 앱 종료 후 스레드가 남지 않게 한다.
 */

public final class MessageWorker implements SmartLifecycle {
    private final MessageDispatcher dispatcher;private final ScMessagingProperties props;private final MessageDiagnostics diagnostics;
    private volatile ScheduledExecutorService executor;
    private final org.springframework.beans.factory.ObjectProvider<dev.scframework.autoconfigure.storage.FileRecoveryService> recovery;
    public MessageWorker(MessageDispatcher dispatcher,ScMessagingProperties props,MessageDiagnostics diagnostics,org.springframework.beans.factory.ObjectProvider<dev.scframework.autoconfigure.storage.FileRecoveryService> recovery){this.dispatcher=dispatcher;this.props=props;this.diagnostics=diagnostics;this.recovery=recovery;}
    // 중복 start를 무시하고 fixed delay로 한 회차 완료 뒤 다음 대기 시간을 센다. 회차가 겹치지 않는다.
    @Override public synchronized void start(){if(isRunning())return;executor=Executors.newSingleThreadScheduledExecutor(r->{Thread thread=new Thread(r,"sc-message-dispatch");thread.setDaemon(true);return thread;});executor.scheduleWithFixedDelay(()->{try{dev.scframework.autoconfigure.storage.FileRecoveryService service=recovery.getIfAvailable();if(service!=null)service.recover();dispatcher.dispatch();}catch(RuntimeException failure){diagnostics.failed();}},0,props.getPollInterval().toMillis(),TimeUnit.MILLISECONDS);}
    // 종료 시 새로운 회차를 막고 진행 작업을 interrupt한 뒤 최대 10초 종료를 기다린다.
    @Override public synchronized void stop(){ScheduledExecutorService current=executor;executor=null;if(current!=null){current.shutdownNow();try{current.awaitTermination(10,TimeUnit.SECONDS);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();}}}
    @Override public boolean isRunning(){return executor!=null&&!executor.isShutdown();}
    @Override public int getPhase(){return Integer.MAX_VALUE-100;}
}
