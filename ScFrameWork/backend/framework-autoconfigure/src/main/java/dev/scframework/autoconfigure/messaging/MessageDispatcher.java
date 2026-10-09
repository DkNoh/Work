package dev.scframework.autoconfigure.messaging;

import dev.scframework.core.operations.OperationalEvent;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/*
 * outbox에서 전송 가능한 메시지를 claim해 Rabbit confirm/return 결과로 발행 상태를 확정한다.
 * 네트워크 confirm 대기는 TX 밖에서, due/claim/결과 갱신은 짧은 REQUIRES_NEW TX에서 처리한다.
 * 실패 시 상한 있는 지연을 계산해 PENDING/DEAD로 바꾸며 broker 응답 원문은 운영 코드로 노출하지 않는다.
 */

/** claim/확정은 짧은 새 TX, confirm 대기는 ambient TX 밖에서 수행한다. */
public final class MessageDispatcher {
    private final JdbcMessageStore store;private final RabbitTemplate rabbit;private final MessageCodec codec;
    private final ScMessagingProperties props;private final Clock clock;private final MessageDiagnostics diagnostics;private final MessageEvents events;
    private final TransactionTemplate fresh;private final TransactionTemplate outside;
    public MessageDispatcher(JdbcMessageStore store,RabbitTemplate rabbit,MessageCodec codec,ScMessagingProperties props,Clock clock,
            PlatformTransactionManager manager,MessageDiagnostics diagnostics,MessageEvents events){
        this.store=store;this.rabbit=rabbit;this.codec=codec;this.props=props;this.clock=clock;this.diagnostics=diagnostics;this.events=events;
        fresh=new TransactionTemplate(manager);fresh.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        outside=new TransactionTemplate(manager);outside.setPropagationBehavior(TransactionDefinition.PROPAGATION_NOT_SUPPORTED);
    }
    public void dispatch(){outside.executeWithoutResult(ignored->dispatchOutside());}
    // 기한 도래 ID를 읽은 뒤 각 ID를 짧게 claim한다. confirm을 기다리는 동안 DB 트랜잭션을 점유하지 않는다.
    private void dispatchOutside(){
        Instant now=clock.instant();
        java.util.List<UUID> due=fresh.execute(ignored->store.due(now,props.getPublishMaxAttempts(),props.getBatchSize()));
        if(due==null)return;
        for(UUID id:due){
            JdbcMessageStore.Delivery delivery=fresh.execute(ignored->store.claim(id,clock.instant(),clock.instant().plus(props.getLease()),props.getPublishMaxAttempts()));
            if(delivery==null)continue;
            try{
                MessageProperties properties=new MessageProperties();properties.setContentType("application/json");properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT);properties.setMessageId(id.toString());
                CorrelationData correlation=new CorrelationData(UUID.randomUUID().toString());
                rabbit.send(exchange(props),"work",new Message(codec.encode(delivery.message()),properties),correlation);
                CorrelationData.Confirm confirm=correlation.getFuture().get(props.getConfirmTimeout().toMillis(),TimeUnit.MILLISECONDS);
                if(!confirm.isAck()||correlation.getReturned()!=null)throw new IllegalStateException("SC_MESSAGE_CONFIRM_FAILED");
                fresh.executeWithoutResult(ignored->store.published(delivery,clock.instant()));diagnostics.published();events.record(OperationalEvent.Kind.MESSAGE_DISPATCH,OperationalEvent.Outcome.SUCCESS,id);
            }catch(Exception exception){
                if(exception instanceof InterruptedException)Thread.currentThread().interrupt();
                // 실패 횟수 기반 지연에 상한을 적용한다. interrupt는 상위 종료 신호이므로 플래그를 복원한다.
                long multiplier=Math.min(30,1L<<Math.min(delivery.attempts()-1,5));
                java.time.Duration delay=props.getRetryMin().multipliedBy(multiplier);if(delay.compareTo(props.getRetryMax())>0)delay=props.getRetryMax();
                Instant retry=clock.instant().plus(delay);
                fresh.executeWithoutResult(ignored->store.publishFailure(delivery,retry,props.getPublishMaxAttempts(),"BROKER_PUBLISH_FAILED"));
                diagnostics.failed();events.record(OperationalEvent.Kind.MESSAGE_DISPATCH,delivery.attempts()>=props.getPublishMaxAttempts()?OperationalEvent.Outcome.DEAD:OperationalEvent.Outcome.RETRY,id);
            }
        }
    }
    public static String exchange(ScMessagingProperties props){return "sc."+props.getApplicationId()+".events";}
    public static String workQueue(ScMessagingProperties props){return "sc."+props.getApplicationId()+".work";}
    public static String deadQueue(ScMessagingProperties props){return "sc."+props.getApplicationId()+".dead";}
}
