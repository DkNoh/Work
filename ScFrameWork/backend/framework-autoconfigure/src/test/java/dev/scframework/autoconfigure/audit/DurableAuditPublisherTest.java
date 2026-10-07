package dev.scframework.autoconfigure.audit;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.messaging.DurableMessagePublisher;
import java.time.Instant;
import java.util.UUID;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

class DurableAuditPublisherTest {
    SecurityAuditEvent event(String outcome){return new SecurityAuditEvent("synthetic",1L,Instant.parse("2026-10-07T00:00:00Z"),"REQUIREMENT_CREATE",outcome,"REQUIREMENT","1",null,null);}
    @Test void successOutboxSharesBusinessCommitAndRollbackButFailureSurvivesRollback(){
        JdbcDataSource source=new JdbcDataSource();source.setURL("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1");JdbcTemplate jdbc=new JdbcTemplate(source);jdbc.execute("CREATE TABLE pending(event_id VARCHAR(36) PRIMARY KEY,payload VARCHAR(2000))");
        DataSourceTransactionManager manager=new DataSourceTransactionManager(source);TransactionTemplate tx=new TransactionTemplate(manager);
        DurableMessagePublisher publisher=message->jdbc.update("INSERT INTO pending VALUES(?,?)",message.eventId().toString(),message.payload());
        DurableSecurityAuditPublisher audit=new DurableSecurityAuditPublisher(publisher,new ObjectMapper().findAndRegisterModules(),manager,new AuditWriteDiagnostics());
        tx.executeWithoutResult(status->{audit.publish(event("SUCCESS"));status.setRollbackOnly();});assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM pending",Integer.class)).isZero();
        tx.executeWithoutResult(status->audit.publish(event("SUCCESS")));assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM pending",Integer.class)).isEqualTo(1);
        tx.executeWithoutResult(status->{audit.publish(event("FAILURE"));status.setRollbackOnly();});assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM pending",Integer.class)).isEqualTo(2);
    }
    @Test void nonTransactionalAuthenticationKeepsResponseWhenEnqueueFailsButBusinessSuccessFailsClosed(){
        JdbcDataSource source=new JdbcDataSource();source.setURL("jdbc:h2:mem:"+UUID.randomUUID());DataSourceTransactionManager manager=new DataSourceTransactionManager(source);AuditWriteDiagnostics diagnostics=new AuditWriteDiagnostics();
        DurableSecurityAuditPublisher audit=new DurableSecurityAuditPublisher(message->{throw new IllegalStateException("DO_NOT_LOG_PASSWORD");},new ObjectMapper().findAndRegisterModules(),manager,diagnostics);
        assertThatCode(()->audit.publish(event("SUCCESS"))).doesNotThrowAnyException();assertThat(diagnostics.getFailedWrites()).isEqualTo(1);
        assertThatThrownBy(()->new TransactionTemplate(manager).executeWithoutResult(status->audit.publish(event("SUCCESS")))).isInstanceOf(IllegalStateException.class);assertThat(diagnostics.getFailedWrites()).isEqualTo(1);
    }
}
