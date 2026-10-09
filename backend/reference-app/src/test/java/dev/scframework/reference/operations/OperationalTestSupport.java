package dev.scframework.reference.operations;

import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.scheduling.ScheduledRunContext;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.transaction.support.TransactionSynchronizationManager;

public final class OperationalTestSupport {
    public static final String PASSWORD="synthetic-operations-test-password";
    private OperationalTestSupport(){}
    public static Path fixture(){
        // 합성 계정용 임시 파일이다. POSIX 권한 API가 없는 Windows에서는 해당 호출을 생략한다.
        // 운영 secret의 사용자 전용 ACL은 실행기가 별도로 관리하며 이 테스트로 운영 ACL을 검증하지 않는다.
        try{Path root=Files.createTempDirectory("sc-operational-test-");Path secret=Files.writeString(root.resolve("bootstrap.secret"),PASSWORD);if(Files.getFileStore(secret).supportsFileAttributeView("posix"))Files.setPosixFilePermissions(secret,PosixFilePermissions.fromString("rw-------"));return root;}
        catch(IOException failure){throw new IllegalStateException("Could not prepare isolated operation fixture");}
    }
    public static void properties(DynamicPropertyRegistry registry,Path root,String database,String username){
        registry.add("SC_BOOTSTRAP_SECRET_FILE",()->root.resolve("bootstrap.secret").toString());registry.add("SC_BOOTSTRAP_USERNAME",()->username);
        registry.add("spring.datasource.url",()->"jdbc:h2:mem:"+database+root.getFileName()+";DB_CLOSE_DELAY=-1");
        registry.add("spring.flyway.locations",()->"classpath:db/migration,classpath:db/operations-migration");
        registry.add("sc.framework.messaging.enabled",()->false);registry.add("sc.framework.audit.durable-enabled",()->false);registry.add("sc.framework.file-storage.durable-cleanup-enabled",()->false);
        registry.add("sc.framework.scheduler.enabled",()->true);registry.add("sc.framework.scheduler.bootstrap-defaults",()->false);
        registry.add("spring.quartz.job-store-type",()->"jdbc");registry.add("spring.quartz.jdbc.initialize-schema",()->"never");registry.add("spring.quartz.auto-startup",()->false);
        registry.add("spring.quartz.scheduler-name",()->"sc-test-"+root.getFileName());
        registry.add("spring.quartz.properties.org.quartz.jobStore.useProperties",()->true);registry.add("spring.quartz.properties.org.quartz.jobStore.misfireThreshold",()->100);
        registry.add("spring.quartz.properties.org.quartz.threadPool.threadCount",()->2);
        registry.add("sc.framework.browser-errors.enabled",()->true);registry.add("sc.framework.browser-errors.global-per-minute",()->200);
        registry.add("sc.framework.file-storage.root",()->root.resolve("uploads").toString());registry.add("logging.file.name",()->root.resolve("test.log").toString());
    }
    public static void cleanup(Path root)throws IOException{try(var paths=Files.walk(root)){for(Path p:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(p);}}
    @TestConfiguration public static class Config {
        @Bean @Primary public MutableClock operationClock(){return new MutableClock();}
        @Bean public BlockingProbe blockingProbe(){return new BlockingProbe();}
        @Bean public RegisteredOperationalTask blockingTask(BlockingProbe probe){return new RegisteredOperationalTask(){
            @Override public String jobCode(){return "TEST_BLOCK";}
            @Override public void execute(ScheduledRunContext context)throws InterruptedException{
                int active=probe.active.incrementAndGet();probe.maximum.accumulateAndGet(active,Math::max);
                int entered=probe.entries.incrementAndGet();if(entered==1)probe.first.countDown();else probe.second.countDown();
                try{if(!probe.release.await(10,java.util.concurrent.TimeUnit.SECONDS))throw new IllegalStateException("Test operation release timed out");}
                finally{probe.active.decrementAndGet();}
            }
        };}
        @Bean public RegisteredOperationalTask failingTask(DataSource source){return new RegisteredOperationalTask(){
            @Override public String jobCode(){return "TEST_FAIL";}
            @Override public void execute(ScheduledRunContext context){new JdbcTemplate(source).update("INSERT INTO operation_pulse_effect(run_key,occurred_at) VALUES(?,?)",context.runKey(),context.scheduledAt().atOffset(ZoneOffset.UTC));throw new IllegalStateException("OPERATION_PRIVATE_CANARY");}
        };}
        @Bean public RegisteredOperationalTask outsideTask(DataSource source){return new RegisteredOperationalTask(){
            @Override public String jobCode(){return "TEST_OUTSIDE";}
            @Override public ExecutionMode executionMode(){return ExecutionMode.NON_TRANSACTIONAL;}
            @Override public void execute(ScheduledRunContext context){if(TransactionSynchronizationManager.isActualTransactionActive())throw new IllegalStateException("Ambient transaction leaked");new JdbcTemplate(source).update("INSERT INTO operation_pulse_effect(run_key,occurred_at) VALUES(?,?)",context.runKey(),context.scheduledAt().atOffset(ZoneOffset.UTC));}
        };}
    }
    public static final class BlockingProbe {
        public final java.util.concurrent.atomic.AtomicInteger active=new java.util.concurrent.atomic.AtomicInteger();
        public final java.util.concurrent.atomic.AtomicInteger maximum=new java.util.concurrent.atomic.AtomicInteger();
        public final java.util.concurrent.atomic.AtomicInteger entries=new java.util.concurrent.atomic.AtomicInteger();
        public java.util.concurrent.CountDownLatch first,second,release;
        public void reset(){if(release!=null)release.countDown();active.set(0);maximum.set(0);entries.set(0);first=new java.util.concurrent.CountDownLatch(1);second=new java.util.concurrent.CountDownLatch(1);release=new java.util.concurrent.CountDownLatch(1);}
    }
    public static final class MutableClock extends Clock {
        private final AtomicReference<Instant> value=new AtomicReference<>(Instant.parse("2026-10-07T00:00:00Z"));
        public void set(Instant value){this.value.set(value);}
        @Override public ZoneId getZone(){return ZoneOffset.UTC;}
        @Override public Clock withZone(ZoneId zone){if(!ZoneOffset.UTC.equals(zone))throw new IllegalArgumentException("Fixture is UTC");return this;}
        @Override public Instant instant(){return value.get();}
    }
}
