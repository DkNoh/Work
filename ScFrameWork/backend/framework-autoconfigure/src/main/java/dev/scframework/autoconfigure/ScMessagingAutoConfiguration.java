package dev.scframework.autoconfigure;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.autoconfigure.audit.*;
import dev.scframework.autoconfigure.messaging.*;
import dev.scframework.autoconfigure.storage.*;
import dev.scframework.core.audit.SecurityAuditPublisher;
import dev.scframework.core.audit.SecurityAuditSink;
import dev.scframework.core.messaging.*;
import dev.scframework.core.operations.OperationalEventSink;
import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.storage.*;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.listener.SimpleMessageListenerContainer;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.*;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.context.annotation.Bean;
import org.springframework.transaction.PlatformTransactionManager;

@AutoConfiguration(after={ScFileStorageAutoConfiguration.class},before={ScAuditAutoConfiguration.class},afterName={"org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration","org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration","org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration"})
@ConditionalOnProperty(prefix="sc.framework.messaging",name="enabled",havingValue="true")
@EnableConfigurationProperties({ScMessagingProperties.class,ScDurableAuditProperties.class,ScDurableStorageProperties.class})
public class ScMessagingAutoConfiguration {
    @Bean @ConditionalOnMissingBean MessageDiagnostics scMessageDiagnostics(){return new MessageDiagnostics();}
    @Bean @ConditionalOnMissingBean MessageEvents scMessageEvents(ObjectProvider<OperationalEventSink> sinks){return new MessageEvents(sinks);}
    @Bean @ConditionalOnMissingBean @DependsOnDatabaseInitialization JdbcMessageStore scMessageStore(DataSource source,ScMessagingProperties props){props.validate();return new JdbcMessageStore(source);}
    @Bean @ConditionalOnProperty(prefix="sc.framework.audit",name="durable-enabled",havingValue="true") SecurityAuditMessageHandler scAuditMessageHandler(ObjectMapper mapper,ObjectProvider<SecurityAuditSink> sink){return new SecurityAuditMessageHandler(mapper,sink);}
    @Bean @ConditionalOnBean(FileStorage.class) @ConditionalOnProperty(prefix="sc.framework.file-storage",name="durable-cleanup-enabled",havingValue="true") FileDeleteMessageHandler scFileDeleteHandler(FileStorage storage,ObjectProvider<FileReferenceLookup> references,ObjectMapper mapper){return new FileDeleteMessageHandler(storage,references,mapper);}
    @Bean @ConditionalOnMissingBean MessageRegistry scMessageRegistry(List<MessageHandler> handlers,ScMessagingProperties props){return new MessageRegistry(handlers,props.getMaxPayloadBytes());}
    @Bean @ConditionalOnMissingBean MessageCodec scMessageCodec(ObjectMapper mapper,MessageRegistry registry){return new MessageCodec(mapper,registry);}
    @Bean @ConditionalOnMissingBean(DurableMessagePublisher.class) DurableMessagePublisher scDurableMessagePublisher(JdbcMessageStore store,MessageRegistry registry){return new JdbcDurableMessagePublisher(store,registry);}
    @Bean @ConditionalOnMissingBean(SecurityAuditPublisher.class) @ConditionalOnProperty(prefix="sc.framework.audit",name="durable-enabled",havingValue="true") DurableSecurityAuditPublisher scDurableAuditPublisher(DurableMessagePublisher publisher,ObjectMapper mapper,PlatformTransactionManager manager,AuditWriteDiagnostics diagnostics){return new DurableSecurityAuditPublisher(publisher,mapper,manager,diagnostics);}
    @Bean @ConditionalOnMissingBean MessageDispatcher scMessageDispatcher(JdbcMessageStore store,RabbitTemplate rabbit,MessageCodec codec,ScMessagingProperties props,Clock clock,PlatformTransactionManager manager,MessageDiagnostics diagnostics,MessageEvents events){
        if(!rabbit.getConnectionFactory().isPublisherConfirms()||!rabbit.getConnectionFactory().isPublisherReturns()||!Boolean.TRUE.equals(rabbit.isMandatoryFor(new Message(new byte[0],new MessageProperties()))))throw new IllegalArgumentException("SC_RABBIT_CONFIRM_CONFIGURATION_REQUIRED");
        return new MessageDispatcher(store,rabbit,codec,props,clock,manager,diagnostics,events);
    }
    @Bean Declarables scMessageTopology(ScMessagingProperties props){
        String exchange=MessageDispatcher.exchange(props);DirectExchange events=new DirectExchange(exchange,true,false);
        DirectExchange dead=new DirectExchange(exchange+".dead",true,false);
        Map<String,Object> workArgs=Map.of("x-queue-type","quorum","x-delivery-limit",4,"x-dead-letter-exchange",dead.getName(),"x-dead-letter-routing-key","dead","x-dead-letter-strategy","at-least-once","x-overflow","reject-publish","x-max-length",10000,"x-delayed-retry-type","failed","x-delayed-retry-min",props.getRetryMin().toMillis(),"x-delayed-retry-max",props.getRetryMax().toMillis());
        Queue work=new Queue(MessageDispatcher.workQueue(props),true,false,false,workArgs);
        // DLQ는 업무 재실행 큐가 아니다. DB 장애 동안 terminal envelope를 유실 없이 보존한다.
        Queue terminal=new Queue(MessageDispatcher.deadQueue(props),true,false,false,Map.of("x-queue-type","quorum","x-delivery-limit",-1,"x-delayed-retry-type","failed","x-delayed-retry-min",1000,"x-delayed-retry-max",30000));
        return new Declarables(events,dead,work,terminal,BindingBuilder.bind(work).to(events).with("work"),BindingBuilder.bind(terminal).to(dead).with("dead"));
    }
    @Bean SimpleMessageListenerContainer scWorkMessageContainer(ConnectionFactory connection,JdbcMessageStore store,MessageCodec codec,MessageRegistry registry,ScMessagingProperties props,Clock clock,PlatformTransactionManager manager,MessageDiagnostics diagnostics,MessageEvents events,Declarables scMessageTopology){return container(connection,MessageDispatcher.workQueue(props),new MessageConsumer(store,codec,registry,props,clock,manager,false,diagnostics,events),props);}
    @Bean SimpleMessageListenerContainer scDeadMessageContainer(ConnectionFactory connection,JdbcMessageStore store,MessageCodec codec,MessageRegistry registry,ScMessagingProperties props,Clock clock,PlatformTransactionManager manager,MessageDiagnostics diagnostics,MessageEvents events,Declarables scMessageTopology){return container(connection,MessageDispatcher.deadQueue(props),new MessageConsumer(store,codec,registry,props,clock,manager,true,diagnostics,events),props);}
    private static SimpleMessageListenerContainer container(ConnectionFactory connection,String queue,MessageConsumer listener,ScMessagingProperties props){SimpleMessageListenerContainer container=new SimpleMessageListenerContainer(connection);container.setQueueNames(queue);container.setAcknowledgeMode(AcknowledgeMode.MANUAL);container.setPrefetchCount(props.getPrefetch());container.setConcurrentConsumers(1);container.setMaxConcurrentConsumers(1);container.setDefaultRequeueRejected(false);container.setMissingQueuesFatal(false);container.setMessageListener(listener);container.setErrorHandler(failure->{});return container;}
    @Bean @ConditionalOnBean(FileStorage.class) @ConditionalOnProperty(prefix="sc.framework.file-storage",name="durable-cleanup-enabled",havingValue="true") FileRecoveryService scFileRecovery(FileStorage storage,ObjectProvider<FileReferenceLookup> references,DurableMessagePublisher publisher,Clock clock,PlatformTransactionManager manager,ObjectProvider<OperationalEventSink> sinks){if(!(storage instanceof RecoverableFileStorage recovery))throw new IllegalArgumentException("SC_RECOVERABLE_STORAGE_REQUIRED");return new FileRecoveryService(recovery,references,publisher,clock,manager,sinks);}
    @Bean MessageWorker scMessageWorker(MessageDispatcher dispatcher,ScMessagingProperties props,MessageDiagnostics diagnostics,ObjectProvider<FileRecoveryService> recovery){return new MessageWorker(dispatcher,props,diagnostics,recovery);}
    @Bean RegisteredOperationalTask scOutboxTask(ObjectProvider<MessageDispatcher> dispatcher){return MessageOperationalTasks.outbox(dispatcher);}
    @Bean @ConditionalOnBean(FileRecoveryService.class) RegisteredOperationalTask scFileRecoveryTask(ObjectProvider<FileRecoveryService> recovery){return MessageOperationalTasks.files(recovery);}
}
