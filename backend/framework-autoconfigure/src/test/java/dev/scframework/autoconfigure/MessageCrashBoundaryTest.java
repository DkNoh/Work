package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import dev.scframework.autoconfigure.messaging.*;
import dev.scframework.core.messaging.*;
import dev.scframework.core.operations.OperationalEventSink;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.listener.SimpleMessageListenerContainer;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** 제품 코드에 hook을 추가하지 않고 실제 confirm/commit 경계에서 자기 child JVM만 종료한다. */
@EnabledIfEnvironmentVariable(named="SC_MQ_TEST",matches="true")
class MessageCrashBoundaryTest {
    @TempDir Path directory;
    @Test void confirmedBeforePublishedMarkCrashReplaysWithOneCommittedEffect()throws Exception{run("publish");}
    @Test void committedBeforeAckCrashRedeliversWithoutSecondEffectOrAttempt()throws Exception{run("ack");}
    private void run(String boundary)throws Exception{
        Path folder=directory.toRealPath();String application="crash-"+UUID.randomUUID();ScMessagingProperties props=properties(application);
        JdbcDataSource source=source(folder);JdbcTemplate jdbc=new JdbcTemplate(source);schema(jdbc);
        DataSourceTransactionManager manager=new DataSourceTransactionManager(source);TransactionTemplate tx=new TransactionTemplate(manager);JdbcMessageStore store=new JdbcMessageStore(source);
        ScMessage event=new ScMessage(UUID.randomUUID(),"MESSAGE_DEMO",1,Clock.systemUTC().instant(),"{}");tx.executeWithoutResult(ignored->store.enqueue(event));
        CachingConnectionFactory connection=connection();RabbitTemplate rabbit=new RabbitTemplate(connection);rabbit.setMandatory(true);RabbitAdmin admin=new RabbitAdmin(connection);
        MessageRegistry registry=registry(jdbc);MessageCodec codec=new MessageCodec(new ObjectMapper().findAndRegisterModules(),registry);MessageDiagnostics diagnostics=new MessageDiagnostics();MessageEvents events=events();
        Process child=null;SimpleMessageListenerContainer listener=null;Path log=folder.resolve("child.log");
        try{
            topology(admin,props);
            if(boundary.equals("ack"))new MessageDispatcher(store,rabbit,codec,props,Clock.systemUTC(),manager,diagnostics,events).dispatch();
            String javaExecutable=Path.of(System.getProperty("java.home"),"bin","java").toString();
            String classpath=System.getProperty("surefire.test.class.path",System.getProperty("java.class.path"));
            child=new ProcessBuilder(javaExecutable,"-cp",classpath,Child.class.getName(),boundary,folder.toString(),application).redirectOutput(log.toFile()).redirectError(log.toFile()).start();
            Process running=child;await(()->running.isAlive()&&contains(log,"SC_BOUNDARY_READY"),Duration.ofSeconds(25));
            child.destroyForcibly();assertThat(child.waitFor(10,java.util.concurrent.TimeUnit.SECONDS)).isTrue();assertThat(child.exitValue()).isNotZero();
            if(boundary.equals("publish")){
                assertThat(store.find(event.eventId()).state()).isEqualTo(JdbcMessageStore.State.CLAIMED);
                await(()->!store.due(Clock.systemUTC().instant(),5,20).isEmpty(),Duration.ofSeconds(8));
                new MessageDispatcher(store,rabbit,codec,props,Clock.systemUTC(),manager,diagnostics,events).dispatch();
            }else{
                assertThat(store.find(event.eventId()).state()).isEqualTo(JdbcMessageStore.State.COMPLETED);
                assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM effects",Integer.class)).isEqualTo(1);
            }
            listener=container(connection,props,new MessageConsumer(store,codec,registry,props,Clock.systemUTC(),manager,false,diagnostics,events));listener.start();
            await(()->diagnostics.getDuplicates()>=1&&store.find(event.eventId()).state()==JdbcMessageStore.State.COMPLETED,Duration.ofSeconds(20));
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM effects",Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sc_message_inbox",Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT handler_attempts FROM sc_message_outbox",Integer.class)).isEqualTo(1);
        }finally{
            if(child!=null&&child.isAlive()){child.destroyForcibly();child.waitFor(10,java.util.concurrent.TimeUnit.SECONDS);}
            if(listener!=null)listener.stop();
            try{admin.deleteQueue(MessageDispatcher.workQueue(props));admin.deleteQueue(MessageDispatcher.deadQueue(props));admin.deleteExchange(MessageDispatcher.exchange(props));admin.deleteExchange(MessageDispatcher.exchange(props)+".dead");}finally{connection.destroy();}
        }
    }
    static ScMessagingProperties properties(String application){ScMessagingProperties props=new ScMessagingProperties();props.setApplicationId(application);props.setConfirmTimeout(Duration.ofMillis(500));props.setLease(Duration.ofSeconds(2));props.setRetryMin(Duration.ofMillis(100));props.setRetryMax(Duration.ofSeconds(1));return props;}
    static CachingConnectionFactory connection()throws Exception{CachingConnectionFactory connection=new CachingConnectionFactory("127.0.0.1",Integer.parseInt(System.getenv().getOrDefault("SC_MQ_PORT","5679")));connection.setUsername("sc-framework");connection.setPassword(Files.readString(Path.of(System.getenv("SC_MQ_PASSWORD_FILE"))).strip());connection.setPublisherConfirmType(CachingConnectionFactory.ConfirmType.CORRELATED);connection.setPublisherReturns(true);return connection;}
    static JdbcDataSource source(Path folder){JdbcDataSource source=new JdbcDataSource();source.setURL("jdbc:h2:file:"+folder.resolve("test")+";DB_CLOSE_ON_EXIT=FALSE");return source;}
    static MessageRegistry registry(JdbcTemplate jdbc){return new MessageRegistry(List.of(new MessageHandler(){public String type(){return "MESSAGE_DEMO";}public void validate(String payload){if(!"{}".equals(payload))throw new IllegalArgumentException("SC_TEST_PAYLOAD_INVALID");}public void handle(ScMessage event){jdbc.update("INSERT INTO effects VALUES(?)",event.eventId().toString());}}),16384);}
    static MessageEvents events(){return new MessageEvents(new DefaultListableBeanFactory().getBeanProvider(OperationalEventSink.class));}
    static void topology(RabbitAdmin admin,ScMessagingProperties props){for(Declarable item:new ScMessagingAutoConfiguration().scMessageTopology(props).getDeclarables()){if(item instanceof Exchange exchange)admin.declareExchange(exchange);else if(item instanceof Queue queue)admin.declareQueue(queue);else if(item instanceof Binding binding)admin.declareBinding(binding);}}
    static SimpleMessageListenerContainer container(CachingConnectionFactory connection,ScMessagingProperties props,org.springframework.amqp.rabbit.listener.api.ChannelAwareMessageListener listener){SimpleMessageListenerContainer container=new SimpleMessageListenerContainer(connection);container.setQueueNames(MessageDispatcher.workQueue(props));container.setAcknowledgeMode(AcknowledgeMode.MANUAL);container.setPrefetchCount(1);container.setMessageListener(listener);container.setErrorHandler(failure->{});return container;}
    static void schema(JdbcTemplate jdbc){
        jdbc.execute("CREATE TABLE sc_message_outbox(event_id VARCHAR(36) PRIMARY KEY,type VARCHAR(64),schema_version INT,payload VARCHAR(16384),payload_sha256 VARCHAR(64),state VARCHAR(16),dispatch_attempts INT DEFAULT 0,handler_attempts INT DEFAULT 0,next_attempt_at TIMESTAMP WITH TIME ZONE,created_at TIMESTAMP WITH TIME ZONE,published_at TIMESTAMP WITH TIME ZONE,completed_at TIMESTAMP WITH TIME ZONE,lease_token VARCHAR(36),lease_until TIMESTAMP WITH TIME ZONE,last_failure_code VARCHAR(32))");
        jdbc.execute("CREATE TABLE sc_message_inbox(consumer_id VARCHAR(48),event_id VARCHAR(36),processed_at TIMESTAMP WITH TIME ZONE,payload_sha256 VARCHAR(64),PRIMARY KEY(consumer_id,event_id))");jdbc.execute("CREATE TABLE effects(event_id VARCHAR(36) PRIMARY KEY)");
    }
    static boolean contains(Path log,String marker){try{return Files.exists(log)&&Files.readString(log).contains(marker);}catch(java.io.IOException failure){return false;}}
    static void await(java.util.function.BooleanSupplier condition,Duration timeout){long end=System.nanoTime()+timeout.toNanos();while(System.nanoTime()<end){if(condition.getAsBoolean())return;try{Thread.sleep(50);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new AssertionError("SC_TEST_INTERRUPTED");}}throw new AssertionError("SC_TEST_CRASH_BOUNDARY_TIMEOUT");}
    static Object invoke(Object target,java.lang.reflect.Method method,Object[] arguments)throws Throwable{try{return method.invoke(target,arguments);}catch(InvocationTargetException failure){throw failure.getCause();}}
    static void barrier(){System.out.println("SC_BOUNDARY_READY");System.out.flush();try{Thread.sleep(60000);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new IllegalStateException("SC_TEST_CHILD_INTERRUPTED");}throw new IllegalStateException("SC_TEST_CHILD_NOT_KILLED");}
    public static class Child {
        public static void main(String[] args)throws Exception{
            String boundary=args[0];JdbcDataSource actual=source(Path.of(args[1]));DataSource source=actual;
            if(boundary.equals("publish"))source=(DataSource)Proxy.newProxyInstance(DataSource.class.getClassLoader(),new Class<?>[]{DataSource.class},(proxy,method,values)->{
                Object result=invoke(actual,method,values);
                if(result instanceof Connection connection)return Proxy.newProxyInstance(Connection.class.getClassLoader(),new Class<?>[]{Connection.class},(connectionProxy,connectionMethod,connectionValues)->{
                    Object prepared=invoke(connection,connectionMethod,connectionValues);
                    if(prepared instanceof PreparedStatement statement&&connectionValues!=null&&connectionValues.length>0&&connectionValues[0] instanceof String sql&&sql.contains("SET state='PUBLISHED'"))return Proxy.newProxyInstance(PreparedStatement.class.getClassLoader(),new Class<?>[]{PreparedStatement.class},(statementProxy,statementMethod,statementValues)->{if(statementMethod.getName().equals("executeUpdate"))barrier();return invoke(statement,statementMethod,statementValues);});
                    return prepared;
                });return result;
            });
            JdbcTemplate jdbc=new JdbcTemplate(source);JdbcMessageStore store=new JdbcMessageStore(source);DataSourceTransactionManager manager=new DataSourceTransactionManager(source);ScMessagingProperties props=properties(args[2]);CachingConnectionFactory connection=connection();RabbitTemplate rabbit=new RabbitTemplate(connection);rabbit.setMandatory(true);MessageRegistry registry=registry(jdbc);MessageCodec codec=new MessageCodec(new ObjectMapper().findAndRegisterModules(),registry);MessageDiagnostics diagnostics=new MessageDiagnostics();
            if(boundary.equals("publish"))new MessageDispatcher(store,rabbit,codec,props,Clock.systemUTC(),manager,diagnostics,events()).dispatch();
            else{
                MessageConsumer delegate=new MessageConsumer(store,codec,registry,props,Clock.systemUTC(),manager,false,diagnostics,events());
                SimpleMessageListenerContainer container=container(connection,props,(message,channel)->{
                    Channel proxy=(Channel)Proxy.newProxyInstance(Channel.class.getClassLoader(),new Class<?>[]{Channel.class},(target,method,values)->{if(method.getName().equals("basicAck"))barrier();return invoke(channel,method,values);});delegate.onMessage(message,proxy);
                });container.start();Thread.sleep(60000);
            }
        }
    }
}
