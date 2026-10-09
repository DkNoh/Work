package dev.scframework.autoconfigure;

import dev.scframework.autoconfigure.storage.*;
import dev.scframework.core.storage.FileStorage;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

/*
 * file-storage.enabled를 선택했을 때만 로컬 저장소와 DB-파일 생명주기 어댑터를 등록한다.
 * FileStorage SPI를 앱이 제공하면 기본 저장소를 대체한다. durable 옵션은 journal/outbox 정리 사용 여부를 결정한다.
 */

@AutoConfiguration
@EnableConfigurationProperties({ScFileStorageProperties.class,ScDurableStorageProperties.class})
@ConditionalOnProperty(prefix = "sc.framework.file-storage", name = "enabled", havingValue = "true")
public class ScFileStorageAutoConfiguration {
    @Bean @ConditionalOnMissingBean(FileStorage.class)
    FileStorage scFileStorage(ScFileStorageProperties properties,ScDurableStorageProperties durable) { return new LocalFileStorage(properties.getRoot(), properties.getMaxBytes(),durable.isDurableCleanupEnabled()); }
    @Bean @ConditionalOnMissingBean(FileStorageTransactions.class)
    FileStorageTransactions scFileStorageTransactions(FileStorage storage,org.springframework.beans.factory.ObjectProvider<dev.scframework.core.messaging.DurableMessagePublisher> publisher,org.springframework.beans.factory.ObjectProvider<org.springframework.transaction.PlatformTransactionManager> manager,ScDurableStorageProperties durable) { return new FileStorageTransactions(storage,publisher,manager,durable.isDurableCleanupEnabled()); }
}
