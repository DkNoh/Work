package dev.scframework.starter.operations;

import dev.scframework.core.messaging.MessageHandler;
import dev.scframework.core.messaging.ScMessage;
import dev.scframework.core.storage.FileReferenceLookup;
import dev.scframework.starter.storage.StorageDemoController;
import javax.sql.DataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

/** 업무 테이블/Reference import 없이 중립 effect와 현재 실행의 파일 whitelist만 사용한다. */
@Configuration(proxyBeanMethods=false)
@ConditionalOnProperty(prefix="sc.framework.messaging",name="enabled",havingValue="true")
public class StarterMessageAdapters {
    @Bean FileReferenceLookup starterFileReferences(ObjectProvider<StorageDemoController> storage){return key->{StorageDemoController demo=storage.getIfAvailable();return demo!=null&&demo.isReferenced(key);};}
    @Bean MessageHandler starterMessageDemo(DataSource source){JdbcTemplate jdbc=new JdbcTemplate(source);return new MessageHandler(){public String type(){return "MESSAGE_DEMO";}public void validate(String payload){if(!"{}".equals(payload))throw new IllegalArgumentException("SC_MESSAGE_DEMO_INVALID");}public void handle(ScMessage message){jdbc.update("INSERT INTO sc_message_demo_effect(event_id,occurred_at) VALUES(?,?)",message.eventId().toString(),message.occurredAt().atOffset(java.time.ZoneOffset.UTC));}};}
}
