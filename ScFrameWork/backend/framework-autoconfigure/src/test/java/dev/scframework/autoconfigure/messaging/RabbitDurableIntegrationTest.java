package dev.scframework.autoconfigure.messaging;

import static org.assertj.core.api.Assertions.*;
import dev.scframework.autoconfigure.ScAuditAutoConfiguration;
import dev.scframework.autoconfigure.ScMessagingAutoConfiguration;
import dev.scframework.core.messaging.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.listener.SimpleMessageListenerContainer;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.transaction.PlatformTransactionManager;

/** 실제 broker는 Root가 격리 기동한다. 고유 quorum 큐만 만들고 반드시 제거한다. */
@EnabledIfEnvironmentVariable(named="SC_MQ_TEST",matches="true")
class RabbitDurableIntegrationTest {
    @Test void nativeQuorumHasExactlyFiveHandlerAttemptsDlqRetryAndDuplicateDelivery()throws Exception{
        DurableMessagingTest fixture=new DurableMessagingTest();fixture.setup();fixture.fail=true;
        String application="test-"+UUID.randomUUID().toString();
        CachingConnectionFactory connection=new CachingConnectionFactory("127.0.0.1",Integer.parseInt(System.getenv().getOrDefault("SC_MQ_PORT","5679")));
        connection.setUsername("sc-framework");connection.setPassword(Files.readString(Path.of(System.getenv("SC_MQ_PASSWORD_FILE"))).strip());connection.setPublisherConfirmType(CachingConnectionFactory.ConfirmType.CORRELATED);connection.setPublisherReturns(true);
        RabbitTemplate rabbit=new RabbitTemplate(connection);rabbit.setMandatory(true);RabbitAdmin admin=new RabbitAdmin(connection);
        try{new ApplicationContextRunner().withConfiguration(AutoConfigurations.of(ScMessagingAutoConfiguration.class,ScAuditAutoConfiguration.class))
            .withPropertyValues("sc.framework.messaging.enabled=true","sc.framework.messaging.application-id="+application,"sc.framework.messaging.retry-min=100ms","sc.framework.messaging.retry-max=1000ms","sc.framework.messaging.poll-interval=100ms")
            .withBean(DataSource.class,()->fixture.jdbc.getDataSource()).withBean(PlatformTransactionManager.class,()->fixture.manager)
            .withBean(Clock.class,Clock::systemUTC).withBean(com.fasterxml.jackson.databind.ObjectMapper.class,()->new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules())
            .withBean(org.springframework.amqp.rabbit.connection.ConnectionFactory.class,()->connection).withBean(RabbitTemplate.class,()->rabbit).withBean(RabbitAdmin.class,()->admin)
            .withBean(MessageHandler.class,()->fixture.registry.require(new ScMessage(UUID.randomUUID(),"MESSAGE_DEMO",1,fixture.now,"{}")))
            .run(context->{
                assertThat(context).hasNotFailed();ScMessagingProperties properties=context.getBean(ScMessagingProperties.class);MessageCodec codec=context.getBean(MessageCodec.class);
                try{
                    ScMessage event=new ScMessage(UUID.randomUUID(),"MESSAGE_DEMO",1,Clock.systemUTC().instant(),"{}");fixture.tx.executeWithoutResult(status->fixture.store.enqueue(event));await(()->fixture.store.find(event.eventId()).state()==JdbcMessageStore.State.DEAD,Duration.ofSeconds(40));
                    assertThat(fixture.calls).hasValue(5);assertThat(fixture.jdbc.queryForObject("SELECT handler_attempts FROM sc_message_outbox",Integer.class)).isEqualTo(5);assertThat(fixture.store.processed(application,event.eventId())).isFalse();
                    fixture.fail=false;assertThat(fixture.tx.<Boolean>execute(status->fixture.store.retry(event.eventId(),Clock.systemUTC().instant()))).isTrue();await(()->fixture.store.find(event.eventId()).state()==JdbcMessageStore.State.COMPLETED,Duration.ofSeconds(15));assertThat(fixture.calls).hasValue(6);
                    MessageProperties wire=new MessageProperties();wire.setDeliveryMode(MessageDeliveryMode.PERSISTENT);wire.setContentType("application/json");CorrelationData duplicate=new CorrelationData(UUID.randomUUID().toString());
                    rabbit.send(MessageDispatcher.exchange(properties),"work",new Message(codec.encode(event),wire),duplicate);
                    try{assertThat(duplicate.getFuture().get(5,java.util.concurrent.TimeUnit.SECONDS).isAck()).isTrue();}catch(Exception failure){throw new AssertionError("SC_TEST_CONFIRM_FAILED");}
                    await(()->context.getBean(MessageDiagnostics.class).getDuplicates()>=1,Duration.ofSeconds(10));assertThat(fixture.calls).hasValue(6);assertThat(fixture.jdbc.queryForObject("SELECT handler_attempts FROM sc_message_outbox",Integer.class)).isEqualTo(1);
                }finally{
                    context.getBean(MessageWorker.class).stop();context.getBeansOfType(SimpleMessageListenerContainer.class).values().forEach(SimpleMessageListenerContainer::stop);
                    admin.deleteQueue(MessageDispatcher.workQueue(properties));admin.deleteQueue(MessageDispatcher.deadQueue(properties));admin.deleteExchange(MessageDispatcher.exchange(properties));admin.deleteExchange(MessageDispatcher.exchange(properties)+".dead");
                }
            });}finally{connection.destroy();}
    }
    private static void await(java.util.function.BooleanSupplier condition,Duration timeout){long end=System.nanoTime()+timeout.toNanos();while(System.nanoTime()<end){if(condition.getAsBoolean())return;try{Thread.sleep(50);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new AssertionError("SC_TEST_INTERRUPTED");}}throw new AssertionError("SC_TEST_OPERATION_TIMEOUT");}
}
