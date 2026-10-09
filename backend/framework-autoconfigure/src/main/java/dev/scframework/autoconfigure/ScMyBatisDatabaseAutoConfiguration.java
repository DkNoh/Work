package dev.scframework.autoconfigure;

import dev.scframework.autoconfigure.database.UtcInstantTypeHandler;
import dev.scframework.core.database.DatabaseDialect;
import java.time.Instant;
import org.mybatis.spring.boot.autoconfigure.ConfigurationCustomizer;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

/**
 * 공통 MyBatis mapper가 Db2 UTC TIMESTAMP 계약을 소비하도록 연결한다. 업무 mapper/SQL은 앱에 남긴다.
 * 다른 DB의 시간대 포함 타입에는 MyBatis 기본 변환을 유지한다. 고객이 다른 저장 시간 계약을 사용하면
 * scDatabaseMyBatisCustomizer bean을 교체하거나 해당 mapper에서 명시 typeHandler를 지정할 수 있다.
 */
@AutoConfiguration(after=ScDatabaseAutoConfiguration.class,beforeName="org.mybatis.spring.boot.autoconfigure.MybatisAutoConfiguration")
@ConditionalOnClass(ConfigurationCustomizer.class)
@ConditionalOnBean(DatabaseDialect.class)
public class ScMyBatisDatabaseAutoConfiguration {
    @Bean @ConditionalOnMissingBean(name="scDatabaseMyBatisCustomizer")
    ConfigurationCustomizer scDatabaseMyBatisCustomizer(DatabaseDialect dialect) {
        return configuration -> {
            if(dialect.id().equals("db2"))configuration.getTypeHandlerRegistry().register(Instant.class,new UtcInstantTypeHandler());
        };
    }
}
