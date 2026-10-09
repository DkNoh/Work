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

/*
 * 최소 앱이 공통 메시징 SPI를 소비하는 예제다. MESSAGE_DEMO는 빈 JSON만 받아 중립 효과 테이블에 기록한다.
 * FileReferenceLookup은 현재 실행의 StorageDemo metadata만 조회하므로 Reference 업무 테이블을 복사하지 않는다.
 * handler 효과는 공통 소비기의 inbox와 같은 TX에서 수행된다. 테이블 DDL은 앱 migration이 소유한다.
 */

/** 업무 테이블/Reference import 없이 중립 effect와 현재 실행의 파일 whitelist만 사용한다. */
@Configuration(proxyBeanMethods=false)
@ConditionalOnProperty(prefix="sc.framework.messaging",name="enabled",havingValue="true")
public class StarterMessageAdapters {
    // 파일 정리 worker가 물을 때 그 순간의 currentRun 참조 여부를 읽는다. 저장 예제가 OFF이면 참조가 없다고 판단한다.
    @Bean FileReferenceLookup starterFileReferences(ObjectProvider<StorageDemoController> storage){return key->{StorageDemoController demo=storage.getIfAvailable();return demo!=null&&demo.isReferenced(key);};}
    // validate는 부작용 없는 빈 본문 검사, handle은 inbox와 같은 TX에서 demo 효과 INSERT를 수행한다.
    @Bean MessageHandler starterMessageDemo(DataSource source){JdbcTemplate jdbc=new JdbcTemplate(source);return new MessageHandler(){public String type(){return "MESSAGE_DEMO";}public void validate(String payload){if(!"{}".equals(payload))throw new IllegalArgumentException("SC_MESSAGE_DEMO_INVALID");}public void handle(ScMessage message){jdbc.update("INSERT INTO sc_message_demo_effect(event_id,occurred_at) VALUES(?,?)",message.eventId().toString(),message.occurredAt().atOffset(java.time.ZoneOffset.UTC));}};}
}
