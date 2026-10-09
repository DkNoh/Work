package dev.scframework.reference.operations.messages;

import dev.scframework.core.messaging.MessageHandler;
import dev.scframework.core.messaging.ScMessage;
import dev.scframework.core.storage.FileReferenceLookup;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 공통 메시징/파일 삭제 SPI에 Reference 앱 테이블 계약을 연결한다.
 * 공통 Starter가 이 업무 앱을 import하지 않고 앱이 bean으로 어댑터를 제공하는 의존 방향이다.
 */

@Configuration(proxyBeanMethods=false)
@ConditionalOnProperty(prefix="sc.framework.messaging",name="enabled",havingValue="true")
public class ReferenceMessageAdapters {
    // 삭제 작업 직전에 앱 DB가 여전히 storageKey를 참조하는지 확인하는 SPI다. key를 SQL 바인딩하며 사용자 파일 경로를 직접 조립하지 않는다.
    @Bean FileReferenceLookup referenceFileReferences(DataSource source){JdbcTemplate jdbc=new JdbcTemplate(source);return key->Boolean.TRUE.equals(jdbc.queryForObject("SELECT COUNT(*)>0 FROM stored_file WHERE storage_key=?",Boolean.class,key));}
    // 고정 MESSAGE_DEMO만 처리하고 payload는 정확한 {}만 허용한다. event_id가 있는 실제 효과 행을 기록해 공통 메시지 처리의 DB 경로를 검증한다.
    @Bean MessageHandler referenceMessageDemo(DataSource source){JdbcTemplate jdbc=new JdbcTemplate(source);return new MessageHandler(){public String type(){return "MESSAGE_DEMO";}public void validate(String payload){if(!"{}".equals(payload))throw new IllegalArgumentException("SC_MESSAGE_DEMO_INVALID");}public void handle(ScMessage message){jdbc.update("INSERT INTO sc_message_demo_effect(event_id,occurred_at) VALUES(?,?)",message.eventId().toString(),message.occurredAt().atOffset(java.time.ZoneOffset.UTC));}};}
}
