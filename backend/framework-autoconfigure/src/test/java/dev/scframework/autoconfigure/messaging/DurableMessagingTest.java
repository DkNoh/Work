package dev.scframework.autoconfigure.messaging;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import dev.scframework.core.messaging.*;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

class DurableMessagingTest {
    JdbcTemplate jdbc;JdbcMessageStore store;DataSourceTransactionManager manager;TransactionTemplate tx;
    ScMessagingProperties props;MessageRegistry registry;MessageCodec codec;AtomicInteger calls;volatile boolean fail;
    final Instant now=Instant.parse("2026-10-07T01:00:00Z");
    @BeforeEach void setup(){
        JdbcDataSource source=new JdbcDataSource();source.setURL("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1");jdbc=new JdbcTemplate(source);
        jdbc.execute("CREATE TABLE sc_message_outbox(event_id VARCHAR(36) PRIMARY KEY,type VARCHAR(64),schema_version INT,payload VARCHAR(16384),payload_sha256 VARCHAR(64),state VARCHAR(16),dispatch_attempts INT DEFAULT 0,handler_attempts INT DEFAULT 0,next_attempt_at TIMESTAMP WITH TIME ZONE,created_at TIMESTAMP WITH TIME ZONE,published_at TIMESTAMP WITH TIME ZONE,completed_at TIMESTAMP WITH TIME ZONE,lease_token VARCHAR(36),lease_until TIMESTAMP WITH TIME ZONE,last_failure_code VARCHAR(32))");
        jdbc.execute("CREATE TABLE sc_message_inbox(consumer_id VARCHAR(48),event_id VARCHAR(36),processed_at TIMESTAMP WITH TIME ZONE,payload_sha256 VARCHAR(64),PRIMARY KEY(consumer_id,event_id))");
        jdbc.execute("CREATE TABLE effects(event_id VARCHAR(36) PRIMARY KEY)");
        store=new JdbcMessageStore(source);manager=new DataSourceTransactionManager(source);tx=new TransactionTemplate(manager);
        props=new ScMessagingProperties();props.setApplicationId("sc-test");calls=new AtomicInteger();fail=false;
        registry=new MessageRegistry(List.of(new MessageHandler(){public String type(){return "MESSAGE_DEMO";}public void validate(String payload){if(!"{}".equals(payload))throw new IllegalArgumentException("BAD");}public void handle(ScMessage message){calls.incrementAndGet();jdbc.update("INSERT INTO effects VALUES(?)",message.eventId().toString());if(fail)throw new IllegalStateException("password=NEVER_LOG_THIS");}}),16384);
        codec=new MessageCodec(new ObjectMapper().findAndRegisterModules(),registry);
    }
    ScMessage enqueue(){ScMessage event=new ScMessage(UUID.randomUUID(),"MESSAGE_DEMO",1,now,"{}");tx.executeWithoutResult(status->store.enqueue(event));return event;}
    MessageConsumer consumer(boolean dead){return new MessageConsumer(store,codec,registry,props,Clock.fixed(now,java.time.ZoneOffset.UTC),manager,dead,new MessageDiagnostics(),new MessageEvents(new DefaultListableBeanFactory().getBeanProvider(dev.scframework.core.operations.OperationalEventSink.class)));}
    Message raw(ScMessage event){MessageProperties properties=new MessageProperties();properties.setDeliveryTag(7);return new Message(codec.encode(event),properties);}
    @Test void enqueueAndBusinessRollbackTogether(){
        ScMessage event=new ScMessage(UUID.randomUUID(),"MESSAGE_DEMO",1,now,"{}");
        assertThatThrownBy(()->store.enqueue(event)).hasMessage("SC_MESSAGE_TX_REQUIRED");
        tx.executeWithoutResult(status->{jdbc.update("INSERT INTO effects VALUES(?)",event.eventId().toString());store.enqueue(event);status.setRollbackOnly();});
        assertThat(store.find(event.eventId())).isNull();assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM effects",Integer.class)).isZero();
    }
    @Test void handlerEffectInboxCommitThenDuplicateAckWithoutAttemptConsumption()throws Exception{
        ScMessage event=enqueue();Channel channel=mock(Channel.class);consumer(false).onMessage(raw(event),channel);consumer(false).onMessage(raw(event),channel);
        assertThat(calls).hasValue(1);assertThat(store.find(event.eventId()).state()).isEqualTo(JdbcMessageStore.State.COMPLETED);
        assertThat(jdbc.queryForObject("SELECT handler_attempts FROM sc_message_outbox",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sc_message_inbox",Integer.class)).isEqualTo(1);
        verify(channel,times(2)).basicAck(7,false);verify(channel,never()).basicReject(anyLong(),anyBoolean());
        consumer(true).onMessage(raw(event),channel);assertThat(store.find(event.eventId()).state()).isEqualTo(JdbcMessageStore.State.COMPLETED);
    }
    @Test void failingEffectRollsBackAndOnlyFiveHandlersRunThenDlqAndExplicitRetry()throws Exception{
        ScMessage event=enqueue();fail=true;Channel channel=mock(Channel.class);
        for(int index=0;index<6;index++)consumer(false).onMessage(raw(event),channel);
        assertThat(calls).hasValue(5);assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM effects",Integer.class)).isZero();assertThat(store.processed("sc-test",event.eventId())).isFalse();
        verify(channel,times(5)).basicReject(7,true);verify(channel).basicReject(7,false);
        consumer(true).onMessage(raw(event),channel);assertThat(store.find(event.eventId()).state()).isEqualTo(JdbcMessageStore.State.DEAD);
        assertThat(tx.<Boolean>execute(status->store.retry(event.eventId(),now))).isTrue();assertThat(tx.<Boolean>execute(status->store.retry(event.eventId(),now))).isFalse();
        fail=false;consumer(false).onMessage(raw(event),channel);assertThat(calls).hasValue(6);assertThat(store.find(event.eventId()).state()).isEqualTo(JdbcMessageStore.State.COMPLETED);
    }
    @Test void stalePublisherCannotOverwriteCompletedAndLeaseCasHasOneWinner(){
        ScMessage event=enqueue();JdbcMessageStore.Delivery first=tx.execute(status->store.claim(event.eventId(),now,now.plusSeconds(10),5));
        assertThat(tx.<JdbcMessageStore.Delivery>execute(status->store.claim(event.eventId(),now,now.plusSeconds(10),5))).isNull();
        tx.executeWithoutResult(status->store.complete(event.eventId(),now));tx.executeWithoutResult(status->store.published(first,now));tx.executeWithoutResult(status->store.publishFailure(first,now,5,"BROKER_PUBLISH_FAILED"));
        assertThat(store.find(event.eventId()).state()).isEqualTo(JdbcMessageStore.State.COMPLETED);
    }
    @Test void exhaustedClaimsBecomeDeadAndRetentionOnlyRemovesCompleted(){
        ScMessage event=enqueue();for(int index=0;index<5;index++){JdbcMessageStore.Delivery delivery=tx.execute(status->store.claim(event.eventId(),now,now.plusSeconds(10),5));tx.executeWithoutResult(status->store.publishFailure(delivery,now,5,"BROKER_PUBLISH_FAILED"));}
        assertThat(store.find(event.eventId()).state()).isEqualTo(JdbcMessageStore.State.DEAD);assertThat(tx.<Integer>execute(status->store.retain(now.plusSeconds(1)))).isZero();
        assertThat(store.find(event.eventId()).lastFailureCode()).isEqualTo("BROKER_PUBLISH_FAILED");
    }
    @Test void malformedUnknownOrMismatchedMessagesNeverInvokeHandler()throws Exception{
        ScMessage known=enqueue();Channel channel=mock(Channel.class);MessageProperties properties=new MessageProperties();properties.setDeliveryTag(7);
        consumer(false).onMessage(new Message("{\"password\":\"NOT_ACCEPTED\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8),properties),channel);
        consumer(false).onMessage(raw(new ScMessage(UUID.randomUUID(),"MESSAGE_DEMO",1,now,"{}")),channel);
        assertThat(calls).hasValue(0);verify(channel,times(2)).basicReject(7,false);assertThat(store.find(known.eventId()).state()).isEqualTo(JdbcMessageStore.State.PENDING);
    }
}
