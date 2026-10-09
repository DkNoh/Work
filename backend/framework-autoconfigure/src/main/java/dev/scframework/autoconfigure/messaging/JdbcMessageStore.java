package dev.scframework.autoconfigure.messaging;

import dev.scframework.core.messaging.ScMessage;
import dev.scframework.core.database.DatabaseDialect;
import dev.scframework.autoconfigure.database.StandardDatabaseDialect;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/*
 * outbox/inbox 상태를 같은 앱 DataSource에서 관리하는 JDBC 어댑터다. 메시지 payload 해시로 봉투의 동일성을 확인한다.
 * 상태 변경 WHERE 조건은 동시 작업의 비교 후 갱신(CAS)이며 lease token은 늦은 publisher가 새 claim을 덮지 못하게 한다.
 * enqueue에는 활성 TX가 필요하고 재시도는 DEAD이며 미처리인 행에만, retention은 COMPLETED에만 적용한다.
 */

/** JDBC는 동일 DS/JpaTM에 참여한다. DDL은 앱 Flyway만 소유한다. */
public final class JdbcMessageStore {
    public enum State { PENDING, CLAIMED, PUBLISHED, COMPLETED, DEAD }
    public record Status(UUID eventId, String type, State state, int dispatchAttempts, Instant nextAttemptAt,
            Instant createdAt, Instant publishedAt, Instant completedAt, String lastFailureCode) { }
    public record Delivery(ScMessage message, String payloadHash, UUID leaseToken, int attempts) { }
    public record Page(List<Status> items, long total, int page, int size) { }
    private final JdbcTemplate jdbc;
    private final DatabaseDialect dialect;
    public JdbcMessageStore(DataSource source) { this(source, StandardDatabaseDialect.detect(source)); }
    public JdbcMessageStore(DataSource source, DatabaseDialect dialect) {
        jdbc = new JdbcTemplate(source); this.dialect = dialect;
        try { jdbc.queryForList("SELECT event_id FROM sc_message_outbox WHERE 1=0"); jdbc.queryForList("SELECT event_id FROM sc_message_inbox WHERE 1=0"); }
        catch (RuntimeException exception) { throw new IllegalStateException("SC_MESSAGE_SCHEMA_REQUIRED"); }
    }
    // 현재 트랜잭션의 outbox INSERT만 수행한다. commit 전 메시지를 broker에 보내지 않는다.
    public void enqueue(ScMessage message) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("SC_MESSAGE_TX_REQUIRED");
        jdbc.update("INSERT INTO sc_message_outbox(event_id,type,schema_version,payload,payload_sha256,state,dispatch_attempts,next_attempt_at,created_at) VALUES(?,?,?,?,?,'PENDING',0,?,?)",
                message.eventId().toString(),message.type(),message.schemaVersion(),message.payload(),hash(message.payload()),utc(message.occurredAt()),utc(message.occurredAt()));
    }
    // 만료된 claim 중 전송 한도 초과는 DEAD로 바꾸고, 아직 재시도 가능한 기한 도래 후보만 제한 수만큼 읽는다.
    public List<UUID> due(Instant now, int maxAttempts, int size) {
        jdbc.update("UPDATE sc_message_outbox SET state='DEAD',last_failure_code='PUBLISH_ATTEMPTS_EXHAUSTED',lease_token=NULL,lease_until=NULL WHERE state='CLAIMED' AND lease_until<=? AND dispatch_attempts>=?",utc(now),maxAttempts);
        return jdbc.query(dialect.pageSql("SELECT event_id FROM sc_message_outbox WHERE dispatch_attempts<? AND ((state='PENDING' AND next_attempt_at<=?) OR (state='CLAIMED' AND lease_until<=?)) ORDER BY created_at,event_id",0,size),
                (row,index)->UUID.fromString(row.getString(1)),maxAttempts,utc(now),utc(now));
    }
    // WHERE 상태/기한 조건을 만족한 한 작업자만 행을 차지한다. 새 lease token은 이후 확정 갱신의 소유권 증표다.
    public Delivery claim(UUID id, Instant now, Instant leaseUntil, int maxAttempts) {
        UUID token=UUID.randomUUID();
        int changed=jdbc.update("UPDATE sc_message_outbox SET state='CLAIMED',dispatch_attempts=dispatch_attempts+1,lease_token=?,lease_until=? WHERE event_id=? AND dispatch_attempts<? AND ((state='PENDING' AND next_attempt_at<=?) OR (state='CLAIMED' AND lease_until<=?))",
                token.toString(),utc(leaseUntil),id.toString(),maxAttempts,utc(now),utc(now));
        if(changed==0)return null;
        return jdbc.queryForObject("SELECT * FROM sc_message_outbox WHERE event_id=? AND lease_token=?",(row,index)->delivery(row),id.toString(),token.toString());
    }
    // confirm 이후에도 동일 lease 소유자가 CLAIMED일 때만 PUBLISHED로 바꾼다. 소비가 먼저 COMPLETED로 만든 상태는 되돌리지 않는다.
    public void published(Delivery delivery, Instant now) {
        jdbc.update("UPDATE sc_message_outbox SET state='PUBLISHED',published_at=?,lease_token=NULL,lease_until=NULL,last_failure_code=NULL WHERE event_id=? AND state='CLAIMED' AND lease_token=?",utc(now),delivery.message().eventId().toString(),delivery.leaseToken().toString());
    }
    public void publishFailure(Delivery delivery, Instant due, int maxAttempts, String reason) {
        code(reason);
        jdbc.update("UPDATE sc_message_outbox SET state=?,next_attempt_at=?,last_failure_code=?,lease_token=NULL,lease_until=NULL WHERE event_id=? AND state='CLAIMED' AND lease_token=?",
                delivery.attempts()>=maxAttempts?"DEAD":"PENDING",utc(due),reason,delivery.message().eventId().toString(),delivery.leaseToken().toString());
    }
    // DB에 발행 의도가 있는 eventId/type/schema/payload hash 조합만 소비 대상으로 인정한다.
    public boolean known(ScMessage message) {
        return Long.valueOf(1).equals(jdbc.queryForObject("SELECT COUNT(*) FROM sc_message_outbox WHERE event_id=? AND type=? AND schema_version=? AND payload_sha256=?",Long.class,
                message.eventId().toString(),message.type(),message.schemaVersion(),hash(message.payload())));
    }
    public boolean processed(String consumer, UUID id) {
        return Long.valueOf(1).equals(jdbc.queryForObject("SELECT COUNT(*) FROM sc_message_inbox WHERE consumer_id=? AND event_id=?",Long.class,consumer,id.toString()));
    }
    // handler 실제 시도는 최대 5회다. 이미 inbox 완료된 재전달은 시도 수를 더 쓰지 않는다.
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
    // 관리자가 요청한 DEAD만 초기화한다. 이미 inbox 처리된 메시지는 다시 업무 효과를 내지 않도록 거절한다.
    public boolean retry(UUID id, Instant now) {
        return jdbc.update("UPDATE sc_message_outbox SET state='PENDING',dispatch_attempts=0,handler_attempts=0,next_attempt_at=?,last_failure_code=NULL,published_at=NULL,completed_at=NULL,lease_token=NULL,lease_until=NULL WHERE event_id=? AND state='DEAD' AND NOT EXISTS(SELECT 1 FROM sc_message_inbox WHERE event_id=?)",utc(now),id.toString(),id.toString())==1;
    }
    public Page page(String type, State state, int page, int size) {
        // PostgreSQL의 타입 없는 ? IS NULL 바인딩을 피하고 실제 필터가 있는 조건만 조립한다.
        String condition=" WHERE 1=1";
        var args=new java.util.ArrayList<Object>();
        if(type!=null){condition+=" AND type=?";args.add(type);}
        if(state!=null){condition+=" AND state=?";args.add(state.name());}
        Long total=jdbc.queryForObject("SELECT COUNT(*) FROM sc_message_outbox"+condition,Long.class,args.toArray());
        List<Status> items=jdbc.query(dialect.pageSql("SELECT * FROM sc_message_outbox"+condition+" ORDER BY created_at DESC,event_id DESC",(long)page*size,size),(row,index)->status(row),args.toArray());
        return new Page(List.copyOf(items),total==null?0:total,page,size);
    }
    // 오래된 COMPLETED만 inbox→outbox 순서로 지운다. PENDING/DEAD를 시간만으로 유실시키지 않는다.
    public int retain(Instant before) {
        jdbc.update("DELETE FROM sc_message_inbox WHERE event_id IN(SELECT event_id FROM sc_message_outbox WHERE state='COMPLETED' AND completed_at<?)",utc(before));
        return jdbc.update("DELETE FROM sc_message_outbox WHERE state='COMPLETED' AND completed_at<?",utc(before));
    }
    private Delivery delivery(ResultSet row)throws SQLException {
        return new Delivery(new ScMessage(UUID.fromString(row.getString("event_id")),row.getString("type"),row.getInt("schema_version"),instant(row,"created_at"),row.getString("payload")),row.getString("payload_sha256"),UUID.fromString(row.getString("lease_token")),row.getInt("dispatch_attempts"));
    }
    private Status status(ResultSet row)throws SQLException {
        return new Status(UUID.fromString(row.getString("event_id")),row.getString("type"),State.valueOf(row.getString("state")),row.getInt("dispatch_attempts"),instant(row,"next_attempt_at"),instant(row,"created_at"),instant(row,"published_at"),instant(row,"completed_at"),row.getString("last_failure_code"));
    }
    private Instant instant(ResultSet row,String field)throws SQLException { return dialect.readInstant(row,field); }
    private Object utc(Instant time) { return dialect.timestamp(time); }
    public static String hash(String payload) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException("SC_HASH_UNAVAILABLE"); }
    }
    private static void code(String reason) { if(reason==null||!reason.matches("[A-Z][A-Z0-9_]{0,31}"))throw new IllegalArgumentException("SC_MESSAGE_REASON_INVALID"); }
}
