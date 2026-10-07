package dev.scframework.autoconfigure.messaging;

import dev.scframework.core.messaging.ScMessage;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** JDBC는 동일 DS/JpaTM에 참여한다. DDL은 앱 Flyway만 소유한다. */
public final class JdbcMessageStore {
    public enum State { PENDING, CLAIMED, PUBLISHED, COMPLETED, DEAD }
    public record Status(UUID eventId, String type, State state, int dispatchAttempts, Instant nextAttemptAt,
            Instant createdAt, Instant publishedAt, Instant completedAt, String lastFailureCode) { }
    public record Delivery(ScMessage message, String payloadHash, UUID leaseToken, int attempts) { }
    public record Page(List<Status> items, long total, int page, int size) { }
    private final JdbcTemplate jdbc;
    public JdbcMessageStore(DataSource source) {
        jdbc = new JdbcTemplate(source);
        try { jdbc.queryForList("SELECT event_id FROM sc_message_outbox WHERE 1=0"); jdbc.queryForList("SELECT event_id FROM sc_message_inbox WHERE 1=0"); }
        catch (RuntimeException exception) { throw new IllegalStateException("SC_MESSAGE_SCHEMA_REQUIRED"); }
    }
    public void enqueue(ScMessage message) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("SC_MESSAGE_TX_REQUIRED");
        jdbc.update("INSERT INTO sc_message_outbox(event_id,type,schema_version,payload,payload_sha256,state,dispatch_attempts,next_attempt_at,created_at) VALUES(?,?,?,?,?,'PENDING',0,?,?)",
                message.eventId().toString(),message.type(),message.schemaVersion(),message.payload(),hash(message.payload()),utc(message.occurredAt()),utc(message.occurredAt()));
    }
    public List<UUID> due(Instant now, int maxAttempts, int size) {
        jdbc.update("UPDATE sc_message_outbox SET state='DEAD',last_failure_code='PUBLISH_ATTEMPTS_EXHAUSTED',lease_token=NULL,lease_until=NULL WHERE state='CLAIMED' AND lease_until<=? AND dispatch_attempts>=?",utc(now),maxAttempts);
        return jdbc.query("SELECT event_id FROM sc_message_outbox WHERE dispatch_attempts<? AND ((state='PENDING' AND next_attempt_at<=?) OR (state='CLAIMED' AND lease_until<=?)) ORDER BY created_at,event_id LIMIT ?",
                (row,index)->UUID.fromString(row.getString(1)),maxAttempts,utc(now),utc(now),size);
    }
    public Delivery claim(UUID id, Instant now, Instant leaseUntil, int maxAttempts) {
        UUID token=UUID.randomUUID();
        int changed=jdbc.update("UPDATE sc_message_outbox SET state='CLAIMED',dispatch_attempts=dispatch_attempts+1,lease_token=?,lease_until=? WHERE event_id=? AND dispatch_attempts<? AND ((state='PENDING' AND next_attempt_at<=?) OR (state='CLAIMED' AND lease_until<=?))",
                token.toString(),utc(leaseUntil),id.toString(),maxAttempts,utc(now),utc(now));
        if(changed==0)return null;
        return jdbc.queryForObject("SELECT * FROM sc_message_outbox WHERE event_id=? AND lease_token=?",(row,index)->delivery(row),id.toString(),token.toString());
    }
    public void published(Delivery delivery, Instant now) {
        jdbc.update("UPDATE sc_message_outbox SET state='PUBLISHED',published_at=?,lease_token=NULL,lease_until=NULL,last_failure_code=NULL WHERE event_id=? AND state='CLAIMED' AND lease_token=?",utc(now),delivery.message().eventId().toString(),delivery.leaseToken().toString());
    }
    public void publishFailure(Delivery delivery, Instant due, int maxAttempts, String reason) {
        code(reason);
        jdbc.update("UPDATE sc_message_outbox SET state=?,next_attempt_at=?,last_failure_code=?,lease_token=NULL,lease_until=NULL WHERE event_id=? AND state='CLAIMED' AND lease_token=?",
                delivery.attempts()>=maxAttempts?"DEAD":"PENDING",utc(due),reason,delivery.message().eventId().toString(),delivery.leaseToken().toString());
    }
    public boolean known(ScMessage message) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT COUNT(*)=1 FROM sc_message_outbox WHERE event_id=? AND type=? AND schema_version=? AND payload_sha256=?",Boolean.class,
                message.eventId().toString(),message.type(),message.schemaVersion(),hash(message.payload())));
    }
    public boolean processed(String consumer, UUID id) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT COUNT(*)=1 FROM sc_message_inbox WHERE consumer_id=? AND event_id=?",Boolean.class,consumer,id.toString()));
    }
    public boolean acquireHandlerAttempt(UUID id, String consumer) {
        return jdbc.update("UPDATE sc_message_outbox SET handler_attempts=handler_attempts+1 WHERE event_id=? AND handler_attempts<5 AND state IN('PENDING','CLAIMED','PUBLISHED') AND NOT EXISTS(SELECT 1 FROM sc_message_inbox WHERE consumer_id=? AND event_id=?)",id.toString(),consumer,id.toString())==1;
    }
    public void insertInbox(String consumer, ScMessage message, Instant now) {
        jdbc.update("INSERT INTO sc_message_inbox(consumer_id,event_id,processed_at,payload_sha256) VALUES(?,?,?,?)",consumer,message.eventId().toString(),utc(now),hash(message.payload()));
    }
    public void complete(UUID id, Instant now) {
        jdbc.update("UPDATE sc_message_outbox SET state='COMPLETED',completed_at=?,lease_token=NULL,lease_until=NULL,last_failure_code=NULL WHERE event_id=? AND state<>'COMPLETED'",utc(now),id.toString());
    }
    public void dead(UUID id, String reason) {
        code(reason);
        jdbc.update("UPDATE sc_message_outbox SET state='DEAD',last_failure_code=?,lease_token=NULL,lease_until=NULL WHERE event_id=? AND state<>'COMPLETED'",reason,id.toString());
    }
    public Status find(UUID id) { return jdbc.query("SELECT * FROM sc_message_outbox WHERE event_id=?",(row,index)->status(row),id.toString()).stream().findFirst().orElse(null); }
    public boolean retry(UUID id, Instant now) {
        return jdbc.update("UPDATE sc_message_outbox SET state='PENDING',dispatch_attempts=0,handler_attempts=0,next_attempt_at=?,last_failure_code=NULL,published_at=NULL,completed_at=NULL,lease_token=NULL,lease_until=NULL WHERE event_id=? AND state='DEAD' AND NOT EXISTS(SELECT 1 FROM sc_message_inbox WHERE event_id=?)",utc(now),id.toString(),id.toString())==1;
    }
    public Page page(String type, State state, int page, int size) {
        String condition=" WHERE (? IS NULL OR type=?) AND (? IS NULL OR state=?)";
        String stateName=state==null?null:state.name();
        Long total=jdbc.queryForObject("SELECT COUNT(*) FROM sc_message_outbox"+condition,Long.class,type,type,stateName,stateName);
        List<Status> items=jdbc.query("SELECT * FROM sc_message_outbox"+condition+" ORDER BY created_at DESC,event_id DESC LIMIT ? OFFSET ?",(row,index)->status(row),type,type,stateName,stateName,size,(long)page*size);
        return new Page(List.copyOf(items),total==null?0:total,page,size);
    }
    public int retain(Instant before) {
        jdbc.update("DELETE FROM sc_message_inbox WHERE event_id IN(SELECT event_id FROM sc_message_outbox WHERE state='COMPLETED' AND completed_at<?)",utc(before));
        return jdbc.update("DELETE FROM sc_message_outbox WHERE state='COMPLETED' AND completed_at<?",utc(before));
    }
    private static Delivery delivery(ResultSet row)throws SQLException {
        return new Delivery(new ScMessage(UUID.fromString(row.getString("event_id")),row.getString("type"),row.getInt("schema_version"),instant(row,"created_at"),row.getString("payload")),row.getString("payload_sha256"),UUID.fromString(row.getString("lease_token")),row.getInt("dispatch_attempts"));
    }
    private static Status status(ResultSet row)throws SQLException {
        return new Status(UUID.fromString(row.getString("event_id")),row.getString("type"),State.valueOf(row.getString("state")),row.getInt("dispatch_attempts"),instant(row,"next_attempt_at"),instant(row,"created_at"),instant(row,"published_at"),instant(row,"completed_at"),row.getString("last_failure_code"));
    }
    private static Instant instant(ResultSet row,String field)throws SQLException { OffsetDateTime value=row.getObject(field,OffsetDateTime.class);return value==null?null:value.toInstant(); }
    private static OffsetDateTime utc(Instant time) { return time.atOffset(ZoneOffset.UTC); }
    public static String hash(String payload) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException("SC_HASH_UNAVAILABLE"); }
    }
    private static void code(String reason) { if(reason==null||!reason.matches("[A-Z][A-Z0-9_]{0,31}"))throw new IllegalArgumentException("SC_MESSAGE_REASON_INVALID"); }
}
