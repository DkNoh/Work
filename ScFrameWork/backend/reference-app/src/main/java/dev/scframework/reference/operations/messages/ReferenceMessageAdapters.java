package dev.scframework.reference.operations.messages;

import dev.scframework.core.messaging.MessageHandler;
import dev.scframework.core.messaging.ScMessage;
import dev.scframework.core.storage.FileReferenceLookup;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration(proxyBeanMethods=false)
@ConditionalOnProperty(prefix="sc.framework.messaging",name="enabled",havingValue="true")
public class ReferenceMessageAdapters {
    @Bean FileReferenceLookup referenceFileReferences(DataSource source){JdbcTemplate jdbc=new JdbcTemplate(source);return key->Boolean.TRUE.equals(jdbc.queryForObject("SELECT COUNT(*)>0 FROM stored_file WHERE storage_key=?",Boolean.class,key));}
    @Bean MessageHandler referenceMessageDemo(DataSource source){JdbcTemplate jdbc=new JdbcTemplate(source);return new MessageHandler(){public String type(){return "MESSAGE_DEMO";}public void validate(String payload){if(!"{}".equals(payload))throw new IllegalArgumentException("SC_MESSAGE_DEMO_INVALID");}public void handle(ScMessage message){jdbc.update("INSERT INTO sc_message_demo_effect(event_id,occurred_at) VALUES(?,?)",message.eventId().toString(),message.occurredAt().atOffset(java.time.ZoneOffset.UTC));}};}
}
