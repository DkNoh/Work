package dev.scframework.autoconfigure.messaging;

import com.rabbitmq.client.Channel;
import dev.scframework.core.messaging.ScMessage;
import dev.scframework.core.operations.OperationalEvent;
import java.io.IOException;
import java.time.Clock;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.listener.api.ChannelAwareMessageListener;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/*
 * Rabbit 수신 봉투를 검사하고 handler 효과·inbox·완료 상태를 DB 트랜잭션으로 확정하는 수동 ACK 소비기다.
 * 완료 inbox는 handler 재실행 없이 ACK한다. handler 실패는 rollback 후 재전달하고 시도 횟수는 별도 TX로 남긴다.
 * deadObserver는 DEAD 상태를 기록하는 용도이며 dead 큐 메시지로 업무 handler를 자동 재실행하지 않는다.
 */

/** inbox와 handler effect가 한 TX다. 완료 inbox를 먼저 검사해 중복이 재시도 한도를 소모하지 않는다. */
public final class MessageConsumer implements ChannelAwareMessageListener {
    private final JdbcMessageStore store;private final MessageCodec codec;private final MessageRegistry registry;
    private final String consumer;private final Clock clock;private final boolean deadObserver;private final MessageDiagnostics diagnostics;private final MessageEvents events;
    private final TransactionTemplate fresh;
    public MessageConsumer(JdbcMessageStore store,MessageCodec codec,MessageRegistry registry,ScMessagingProperties props,Clock clock,
            PlatformTransactionManager manager,boolean deadObserver,MessageDiagnostics diagnostics,MessageEvents events){
        this.store=store;this.codec=codec;this.registry=registry;this.consumer=props.getApplicationId();this.clock=clock;this.deadObserver=deadObserver;this.diagnostics=diagnostics;this.events=events;
        fresh=new TransactionTemplate(manager);fresh.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    // decode/발행 근거 확인→중복 확인→시도 확보→inbox+handler+완료 TX→ACK 순서다.
    // ACK 전에 프로세스가 종료돼 재전달돼도 커밋된 inbox가 중복 효과를 막는다.
    @Override public void onMessage(Message raw,Channel channel){
        long tag=raw.getMessageProperties().getDeliveryTag();ScMessage message;
        try{message=codec.decode(raw.getBody());}catch(RuntimeException invalid){reject(channel,tag,false);diagnostics.failed();return;}
        try{
            if(!Boolean.TRUE.equals(fresh.execute(ignored->store.known(message)))){reject(channel,tag,false);return;}
            if(Boolean.TRUE.equals(fresh.execute(ignored->store.processed(consumer,message.eventId())))){
                diagnostics.duplicate();events.record(OperationalEvent.Kind.MESSAGE_CONSUME,OperationalEvent.Outcome.DUPLICATE,message.eventId());ack(channel,tag);return;
            }
            if(deadObserver){fresh.executeWithoutResult(ignored->store.dead(message.eventId(),"HANDLER_ATTEMPTS_EXHAUSTED"));events.record(OperationalEvent.Kind.MESSAGE_DEAD,OperationalEvent.Outcome.DEAD,message.eventId());ack(channel,tag);return;}
            if(!Boolean.TRUE.equals(fresh.execute(ignored->store.acquireHandlerAttempt(message.eventId(),consumer)))){reject(channel,tag,false);return;}
            try{
                fresh.executeWithoutResult(ignored->{
                    store.insertInbox(consumer,message,clock.instant());
                    try{registry.require(message).handle(message);}catch(Exception failure){throw new HandlerFailure();}
                    store.complete(message.eventId(),clock.instant());
                });
            }catch(DuplicateKeyException duplicate){
                if(!Boolean.TRUE.equals(fresh.execute(ignored->store.processed(consumer,message.eventId()))))throw duplicate;
                diagnostics.duplicate();ack(channel,tag);return;
            }
            diagnostics.completed();events.record(OperationalEvent.Kind.MESSAGE_CONSUME,OperationalEvent.Outcome.SUCCESS,message.eventId());ack(channel,tag);
        }catch(RuntimeException failure){
            diagnostics.failed();events.record(deadObserver?OperationalEvent.Kind.MESSAGE_DEAD:OperationalEvent.Kind.MESSAGE_CONSUME,OperationalEvent.Outcome.RETRY,message.eventId());
            // basic.reject(requeue=true)는 quorum failure count를 증가시킨다. nack는 사용하지 않는다.
            reject(channel,tag,true);
        }
    }
    private static final class HandlerFailure extends RuntimeException { HandlerFailure(){super("SC_MESSAGE_HANDLER_FAILURE",null,false,false);} }
    // ACK/reject 송신 자체가 실패하면 channel을 닫아 broker가 미확정 전달을 회수할 수 있게 한다.
    private static void ack(Channel channel,long tag){try{channel.basicAck(tag,false);}catch(IOException failure){abort(channel);}}
    private static void reject(Channel channel,long tag,boolean retry){try{channel.basicReject(tag,retry);}catch(IOException failure){abort(channel);}}
    private static void abort(Channel channel){try{channel.abort();}catch(IOException|RuntimeException ignored){}}
}
