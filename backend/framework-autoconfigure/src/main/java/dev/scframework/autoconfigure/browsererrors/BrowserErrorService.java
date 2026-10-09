package dev.scframework.autoconfigure.browsererrors;

import dev.scframework.core.ApiException;
import dev.scframework.core.database.DatabaseDialect;
import dev.scframework.autoconfigure.database.StandardDatabaseDialect;
import dev.scframework.autoconfigure.database.JdbcDuplicateInsert;
import dev.scframework.core.operations.OperationalEvent;
import dev.scframework.core.operations.OperationalEventSink;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static dev.scframework.autoconfigure.browsererrors.BrowserErrorContracts.*;

/*
 * 허용된 브라우저 오류 코드만 receipt/그룹/발생 이력으로 저장하는 JDBC 서비스다.
 * 동일 actor와 clientEventId는 receipt로 중복 판별하고 fingerprint 그룹 count를 원자적 UPDATE로 합산한다.
 * 수집은 인증된 앱 Controller, 목록/상세 권한은 앱 Controller가 담당하며 이 서비스는 검증/집계/보존 경계를 제공한다.
 */

public class BrowserErrorService {
    private final JdbcTemplate jdbc;
    private final DatabaseDialect dialect;
    private final JdbcDuplicateInsert duplicateInsert;
    private final Clock clock;
    private final ScBrowserErrorsProperties properties;
    private final BrowserErrorRateLimiter limiter;
    private final ObjectProvider<OperationalEventSink> events;
    public BrowserErrorService(DataSource source,Clock clock,ScBrowserErrorsProperties properties,BrowserErrorRateLimiter limiter,ObjectProvider<OperationalEventSink> events){
        this(source,clock,properties,limiter,events,StandardDatabaseDialect.detect(source));
    }
    public BrowserErrorService(DataSource source,Clock clock,ScBrowserErrorsProperties properties,BrowserErrorRateLimiter limiter,ObjectProvider<OperationalEventSink> events,DatabaseDialect dialect){
        jdbc=new JdbcTemplate(source);this.clock=clock;this.properties=properties;this.limiter=limiter;this.events=events;
        this.dialect=dialect;this.duplicateInsert=new JdbcDuplicateInsert(source);
    }
    public void verifySchema(){try{jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_group",Long.class);jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_receipt",Long.class);jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_occurrence",Long.class);}catch(RuntimeException failure){throw new IllegalStateException("Browser error migration is required");}}
    public void admit(String subject){
        if(subject==null||!subject.matches("[A-Za-z0-9._@-]{1,64}"))throw invalid();
        try{limiter.acquire(subject);}catch(ApiException limited){event(OperationalEvent.Kind.BROWSER_ERROR_REJECTED,OperationalEvent.Outcome.FAILURE,null);throw limited;}
    }
    public int retryAfterSeconds(){return limiter.retryAfterSeconds();}
    public void rejected(){event(OperationalEvent.Kind.BROWSER_ERROR_REJECTED,OperationalEvent.Outcome.FAILURE,null);}

    @Transactional
    // receipt와 fingerprint 집계/occurrence INSERT는 한 TX다. 같은 clientEventId의 동일 보고는 count를 다시 올리지 않는다.
    public Accepted accept(Input input,Long actorId,String subject,String requestId){
        String fingerprint;
        try{fingerprint=validate(input);if(actorId!=null&&actorId<1||subject==null||!subject.matches("[A-Za-z0-9._@-]{1,64}"))throw invalid();}
        catch(ApiException failure){rejected();throw failure;}
        Instant now=now();
        UUID eventId=UUID.fromString(input.clientEventId());
        if(!duplicateInsert.insert(()->jdbc.update("INSERT INTO browser_error_receipt(client_event_id,actor_subject,fingerprint,received_at) VALUES(?,?,?,?)",eventId.toString(),subject,fingerprint,utc(now)))){
            String original=jdbc.queryForObject("SELECT fingerprint FROM browser_error_receipt WHERE client_event_id=? AND actor_subject=?",String.class,eventId.toString(),subject);
            if(!fingerprint.equals(original)){rejected();throw invalid();}
            afterCommit(OperationalEvent.Outcome.DUPLICATE,eventId);return new Accepted(true);
        }
        // 중복 INSERT는 savepoint까지만 되돌려 PostgreSQL에서도 앞선 receipt와 같은 TX를 계속한다.
        duplicateInsert.insert(()->jdbc.update("INSERT INTO browser_error_group(fingerprint,app_version,source,event_code,route_code,component_code,first_seen_at,last_seen_at,occurrence_count) VALUES(?,?,?,?,?,?,?,?,0)",fingerprint,input.appVersion(),input.source(),input.eventCode(),input.routeCode(),input.componentCode(),utc(now),utc(now)));
        jdbc.update("UPDATE browser_error_group SET occurrence_count=occurrence_count+1,first_seen_at=CASE WHEN first_seen_at>? THEN ? ELSE first_seen_at END,last_seen_at=CASE WHEN last_seen_at<? THEN ? ELSE last_seen_at END WHERE fingerprint=?",utc(now),utc(now),utc(now),utc(now),fingerprint);
        long groupId=Objects.requireNonNull(jdbc.queryForObject("SELECT id FROM browser_error_group WHERE fingerprint=?",Long.class,fingerprint));
        String safeRequestId=requestId!=null&&requestId.matches("[A-Za-z0-9_-]{1,64}")?requestId:null;
        jdbc.update("INSERT INTO browser_error_occurrence(group_id,actor_id,actor_subject,request_id,occurred_at) VALUES(?,?,?,?,?)",groupId,actorId,subject,safeRequestId,utc(now));
        afterCommit(OperationalEvent.Outcome.SUCCESS,eventId);return new Accepted(true);
    }

    @Transactional(readOnly=true)
    // 필터 값은 등록 집합을 검사하고 SQL 값은 ? 파라미터로 전달한다. 정렬/페이지 상한을 서버에서 고정한다.
    public GroupPage groups(int page,int size,String source,String eventCode){
        bounds(page,size);
        if(source!=null&&!List.of("VUE","WINDOW","REJECTION").contains(source)||eventCode!=null&&!codes().contains(eventCode))throw invalid();
        String filter=" WHERE occurrence_count>0";var args=new java.util.ArrayList<Object>();
        if(source!=null){filter+=" AND source=?";args.add(source);}if(eventCode!=null){filter+=" AND event_code=?";args.add(eventCode);}
        long total=jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_group"+filter,Long.class,args.toArray());
        var rows=jdbc.query(dialect.pageSql("SELECT * FROM browser_error_group"+filter+" ORDER BY last_seen_at DESC,id DESC",(long)page*size,size),(row,index)->new Group(row.getLong("id"),row.getString("fingerprint"),row.getString("app_version"),row.getString("source"),row.getString("event_code"),row.getString("route_code"),row.getString("component_code"),dialect.readInstant(row,"first_seen_at"),dialect.readInstant(row,"last_seen_at"),row.getLong("occurrence_count")),args.toArray());
        return new GroupPage(List.copyOf(rows),total,page,size);
    }
    @Transactional(readOnly=true)
    public OccurrencePage occurrences(long groupId,int page,int size){
        bounds(page,size);if(groupId<1)throw invalid();
        if(jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_group WHERE id=?",Long.class,groupId)==0)throw new ApiException(404,"NOT_FOUND","오류 이력을 찾을 수 없습니다.");
        long total=jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_occurrence WHERE group_id=?",Long.class,groupId);
        var rows=jdbc.query(dialect.pageSql("SELECT * FROM browser_error_occurrence WHERE group_id=? ORDER BY occurred_at DESC,id DESC",(long)page*size,size),(row,index)->new Occurrence(row.getLong("id"),row.getLong("group_id"),row.getObject("actor_id",Long.class),row.getString("actor_subject"),row.getString("request_id"),dialect.readInstant(row,"occurred_at")),groupId);
        return new OccurrencePage(List.copyOf(rows),total,page,size);
    }
    @Transactional
    // 발생/receipt/비활성 그룹을 각 보존 기한과 배치 상한으로 정리한다. 발생 이력이 남은 그룹은 삭제하지 않는다.
    public int retain(){
        Instant now=now();int removed=0;int limit=properties.getRetentionBatchSize();
        var occurrences=jdbc.queryForList(dialect.pageSql("SELECT id FROM browser_error_occurrence WHERE occurred_at<? ORDER BY id",0,limit),Long.class,utc(now.minus(properties.getOccurrenceRetentionDays(),ChronoUnit.DAYS)));
        for(long id:occurrences)removed+=jdbc.update("DELETE FROM browser_error_occurrence WHERE id=?",id);
        var receipts=jdbc.query(dialect.pageSql("SELECT client_event_id,actor_subject FROM browser_error_receipt WHERE received_at<? ORDER BY received_at,client_event_id",0,limit),(row,index)->new Object[]{row.getString(1),row.getString(2)},utc(now.minus(properties.getReceiptRetentionDays(),ChronoUnit.DAYS)));
        for(var receipt:receipts)removed+=jdbc.update("DELETE FROM browser_error_receipt WHERE client_event_id=? AND actor_subject=?",receipt);
        var groups=jdbc.queryForList(dialect.pageSql("SELECT id FROM browser_error_group g WHERE last_seen_at<? AND NOT EXISTS(SELECT 1 FROM browser_error_occurrence o WHERE o.group_id=g.id) ORDER BY id",0,limit),Long.class,utc(now.minus(properties.getInactiveGroupRetentionDays(),ChronoUnit.DAYS)));
        for(long id:groups)removed+=jdbc.update("DELETE FROM browser_error_group WHERE id=? AND NOT EXISTS(SELECT 1 FROM browser_error_occurrence WHERE group_id=?)",id,id);
        return removed;
    }
    // appVersion/route/component allowlist와 source-eventCode 조합을 검사해 고정 필드만 fingerprint에 포함한다.
    private String validate(Input value){
        if(value==null||value.schemaVersion()==null||value.schemaVersion()!=1||value.clientEventId()==null||value.source()==null||value.eventCode()==null
                ||!properties.getAppVersion().equals(value.appVersion())||!properties.getRouteCodes().contains(value.routeCode())||!properties.getComponentCodes().contains(value.componentCode())
                ||!List.of("VUE","WINDOW","REJECTION").contains(value.source())||!codes().contains(value.eventCode()))throw invalid();
        try{if(!UUID.fromString(value.clientEventId()).toString().equals(value.clientEventId()))throw invalid();}catch(IllegalArgumentException bad){throw invalid();}
        String expected=switch(value.source()){case "VUE"->"VUE_ERROR";case "WINDOW"->"WINDOW_ERROR";default->"UNHANDLED_REJECTION";};
        if(!"UNKNOWN_RUNTIME".equals(value.eventCode())&&!expected.equals(value.eventCode()))throw invalid();
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(String.join("\n",value.appVersion(),value.source(),value.eventCode(),value.routeCode(),value.componentCode()).getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException failure){throw new IllegalStateException("Required fingerprint algorithm is unavailable");}
    }
    private static void bounds(int page,int size){if(page<0||page>1_000_000||size<1||size>100)throw invalid();}
    private static List<String> codes(){return List.of("VUE_ERROR","WINDOW_ERROR","UNHANDLED_REJECTION","UNKNOWN_RUNTIME");}
    // 수집 성공 관측은 DB commit 후에만 발행해 rollback된 보고를 성공으로 집계하지 않는다.
    private void afterCommit(OperationalEvent.Outcome outcome,UUID id){
        if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){event(OperationalEvent.Kind.BROWSER_ERROR_ACCEPTED,outcome,id);}});
        else event(OperationalEvent.Kind.BROWSER_ERROR_ACCEPTED,outcome,id);
    }
    private void event(OperationalEvent.Kind kind,OperationalEvent.Outcome outcome,UUID id){events.ifAvailable(sink->{try{sink.record(new OperationalEvent(kind,outcome,id));}catch(RuntimeException ignored){}});}
    private Instant now(){return clock.instant().truncatedTo(ChronoUnit.MICROS);}
    private Object utc(Instant value){return dialect.timestamp(value);}
    private static ApiException invalid(){return new ApiException(400,"INVALID_INPUT","오류 보고 형식을 확인해 주세요.");}
}
