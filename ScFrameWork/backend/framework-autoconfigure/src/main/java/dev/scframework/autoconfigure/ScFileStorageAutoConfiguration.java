package dev.scframework.autoconfigure;

import dev.scframework.autoconfigure.storage.*;
import dev.scframework.core.storage.FileStorage;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@EnableConfigurationProperties({ScFileStorageProperties.class,ScDurableStorageProperties.class})
@ConditionalOnProperty(prefix = "sc.framework.file-storage", name = "enabled", havingValue = "true")
public class ScFileStorageAutoConfiguration {
    @Bean @ConditionalOnMissingBean(FileStorage.class)
    FileStorage scFileStorage(ScFileStorageProperties properties,ScDurableStorageProperties durable) { return new LocalFileStorage(properties.getRoot(), properties.getMaxBytes(),durable.isDurableCleanupEnabled()); }
    @Bean @ConditionalOnMissingBean(FileStorageTransactions.class)
    FileStorageTransactions scFileStorageTransactions(FileStorage storage,org.springframework.beans.factory.ObjectProvider<dev.scframework.core.messaging.DurableMessagePublisher> publisher,org.springframework.beans.factory.ObjectProvider<org.springframework.transaction.PlatformTransactionManager> manager,ScDurableStorageProperties durable) { return new FileStorageTransactions(storage,publisher,manager,durable.isDurableCleanupEnabled()); }
}
