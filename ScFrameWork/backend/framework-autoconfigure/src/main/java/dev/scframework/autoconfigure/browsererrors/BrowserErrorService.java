package dev.scframework.autoconfigure.browsererrors;

import dev.scframework.core.ApiException;
import dev.scframework.core.operations.OperationalEvent;
import dev.scframework.core.operations.OperationalEventSink;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static dev.scframework.autoconfigure.browsererrors.BrowserErrorContracts.*;

public class BrowserErrorService {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final ScBrowserErrorsProperties properties;
    private final BrowserErrorRateLimiter limiter;
    private final ObjectProvider<OperationalEventSink> events;
    public BrowserErrorService(DataSource source,Clock clock,ScBrowserErrorsProperties properties,BrowserErrorRateLimiter limiter,ObjectProvider<OperationalEventSink> events){
        jdbc=new JdbcTemplate(source);this.clock=clock;this.properties=properties;this.limiter=limiter;this.events=events;
    }
    public void verifySchema(){try{jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_group",Long.class);jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_receipt",Long.class);jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_occurrence",Long.class);}catch(RuntimeException failure){throw new IllegalStateException("Browser error migration is required");}}
    public void admit(String subject){
        if(subject==null||!subject.matches("[A-Za-z0-9._@-]{1,64}"))throw invalid();
        try{limiter.acquire(subject);}catch(ApiException limited){event(OperationalEvent.Kind.BROWSER_ERROR_REJECTED,OperationalEvent.Outcome.FAILURE,null);throw limited;}
    }
    public int retryAfterSeconds(){return limiter.retryAfterSeconds();}
    public void rejected(){event(OperationalEvent.Kind.BROWSER_ERROR_REJECTED,OperationalEvent.Outcome.FAILURE,null);}

    @Transactional
    public Accepted accept(Input input,Long actorId,String subject,String requestId){
        String fingerprint;
        try{fingerprint=validate(input);if(actorId!=null&&actorId<1||subject==null||!subject.matches("[A-Za-z0-9._@-]{1,64}"))throw invalid();}
        catch(ApiException failure){rejected();throw failure;}
        Instant now=now();
        UUID eventId=UUID.fromString(input.clientEventId());
        try{jdbc.update("INSERT INTO browser_error_receipt(client_event_id,actor_subject,fingerprint,received_at) VALUES(?,?,?,?)",eventId,subject,fingerprint,utc(now));}
        catch(DuplicateKeyException duplicate){
            String original=jdbc.queryForObject("SELECT fingerprint FROM browser_error_receipt WHERE client_event_id=? AND actor_subject=?",String.class,eventId,subject);
            if(!fingerprint.equals(original)){rejected();throw invalid();}
            afterCommit(OperationalEvent.Outcome.DUPLICATE,eventId);return new Accepted(true);
        }
        try{jdbc.update("INSERT INTO browser_error_group(fingerprint,app_version,source,event_code,route_code,component_code,first_seen_at,last_seen_at,occurrence_count) VALUES(?,?,?,?,?,?,?,?,0)",fingerprint,input.appVersion(),input.source(),input.eventCode(),input.routeCode(),input.componentCode(),utc(now),utc(now));}
        catch(DuplicateKeyException existing){/* H2에서는 중복 statement만 실패한다. 같은 TX의 atomic UPDATE로 합산한다. */}
        jdbc.update("UPDATE browser_error_group SET occurrence_count=occurrence_count+1,first_seen_at=LEAST(first_seen_at,?),last_seen_at=GREATEST(last_seen_at,?) WHERE fingerprint=?",utc(now),utc(now),fingerprint);
        long groupId=Objects.requireNonNull(jdbc.queryForObject("SELECT id FROM browser_error_group WHERE fingerprint=?",Long.class,fingerprint));
        String safeRequestId=requestId!=null&&requestId.matches("[A-Za-z0-9_-]{1,64}")?requestId:null;
        jdbc.update("INSERT INTO browser_error_occurrence(group_id,actor_id,actor_subject,request_id,occurred_at) VALUES(?,?,?,?,?)",groupId,actorId,subject,safeRequestId,utc(now));
        afterCommit(OperationalEvent.Outcome.SUCCESS,eventId);return new Accepted(true);
    }

    @Transactional(readOnly=true)
    public GroupPage groups(int page,int size,String source,String eventCode){
        bounds(page,size);
        if(source!=null&&!List.of("VUE","WINDOW","REJECTION").contains(source)||eventCode!=null&&!codes().contains(eventCode))throw invalid();
        String filter=" WHERE occurrence_count>0";var args=new java.util.ArrayList<Object>();
        if(source!=null){filter+=" AND source=?";args.add(source);}if(eventCode!=null){filter+=" AND event_code=?";args.add(eventCode);}
        long total=jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_group"+filter,Long.class,args.toArray());
        args.add(size);args.add((long)page*size);
        var rows=jdbc.query("SELECT * FROM browser_error_group"+filter+" ORDER BY last_seen_at DESC,id DESC LIMIT ? OFFSET ?",(row,index)->new Group(row.getLong("id"),row.getString("fingerprint"),row.getString("app_version"),row.getString("source"),row.getString("event_code"),row.getString("route_code"),row.getString("component_code"),row.getObject("first_seen_at",OffsetDateTime.class).toInstant(),row.getObject("last_seen_at",OffsetDateTime.class).toInstant(),row.getLong("occurrence_count")),args.toArray());
        return new GroupPage(List.copyOf(rows),total,page,size);
    }
    @Transactional(readOnly=true)
    public OccurrencePage occurrences(long groupId,int page,int size){
        bounds(page,size);if(groupId<1)throw invalid();
        if(jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_group WHERE id=?",Long.class,groupId)==0)throw new ApiException(404,"NOT_FOUND","오류 이력을 찾을 수 없습니다.");
        long total=jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_occurrence WHERE group_id=?",Long.class,groupId);
        var rows=jdbc.query("SELECT * FROM browser_error_occurrence WHERE group_id=? ORDER BY occurred_at DESC,id DESC LIMIT ? OFFSET ?",(row,index)->new Occurrence(row.getLong("id"),row.getLong("group_id"),row.getObject("actor_id",Long.class),row.getString("actor_subject"),row.getString("request_id"),row.getObject("occurred_at",OffsetDateTime.class).toInstant()),groupId,size,(long)page*size);
        return new OccurrencePage(List.copyOf(rows),total,page,size);
    }
    @Transactional
    public int retain(){
        Instant now=now();int removed=0;int limit=properties.getRetentionBatchSize();
        var occurrences=jdbc.queryForList("SELECT id FROM browser_error_occurrence WHERE occurred_at<? ORDER BY id LIMIT ?",Long.class,utc(now.minus(properties.getOccurrenceRetentionDays(),ChronoUnit.DAYS)),limit);
        for(long id:occurrences)removed+=jdbc.update("DELETE FROM browser_error_occurrence WHERE id=?",id);
        var receipts=jdbc.query("SELECT client_event_id,actor_subject FROM browser_error_receipt WHERE received_at<? ORDER BY received_at,client_event_id LIMIT ?",(row,index)->new Object[]{row.getObject(1,UUID.class),row.getString(2)},utc(now.minus(properties.getReceiptRetentionDays(),ChronoUnit.DAYS)),limit);
        for(var receipt:receipts)removed+=jdbc.update("DELETE FROM browser_error_receipt WHERE client_event_id=? AND actor_subject=?",receipt);
        var groups=jdbc.queryForList("SELECT id FROM browser_error_group g WHERE last_seen_at<? AND NOT EXISTS(SELECT 1 FROM browser_error_occurrence o WHERE o.group_id=g.id) ORDER BY id LIMIT ?",Long.class,utc(now.minus(properties.getInactiveGroupRetentionDays(),ChronoUnit.DAYS)),limit);
        for(long id:groups)removed+=jdbc.update("DELETE FROM browser_error_group WHERE id=? AND NOT EXISTS(SELECT 1 FROM browser_error_occurrence WHERE group_id=?)",id,id);
        return removed;
    }
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
    private void afterCommit(OperationalEvent.Outcome outcome,UUID id){
        if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){event(OperationalEvent.Kind.BROWSER_ERROR_ACCEPTED,outcome,id);}});
        else event(OperationalEvent.Kind.BROWSER_ERROR_ACCEPTED,outcome,id);
    }
    private void event(OperationalEvent.Kind kind,OperationalEvent.Outcome outcome,UUID id){events.ifAvailable(sink->{try{sink.record(new OperationalEvent(kind,outcome,id));}catch(RuntimeException ignored){}});}
    private Instant now(){return clock.instant().truncatedTo(ChronoUnit.MICROS);}
    private static OffsetDateTime utc(Instant value){return value.atOffset(ZoneOffset.UTC);}
    private static ApiException invalid(){return new ApiException(400,"INVALID_INPUT","오류 보고 형식을 확인해 주세요.");}
}
