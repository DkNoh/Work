package dev.scframework.autoconfigure.scheduling;

import dev.scframework.core.ApiException;
import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.scheduling.ScheduledRunContext;
import dev.scframework.core.operations.OperationalEvent;
import dev.scframework.core.operations.OperationalEventSink;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.TimeZone;
import java.util.UUID;
import javax.sql.DataSource;
import org.quartz.CronExpression;
import org.quartz.CronScheduleBuilder;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** 앱 DDL·같은 DS/TM을 소비한다. 예약 변경은 Quartz와 같이 commit/rollback한다. */
public class OperationalSchedulerService {
    public static final String GROUP = "sc-operational";
    private final JdbcTemplate jdbc;
    private final Scheduler scheduler;
    private final RegisteredTaskRegistry registry;
    private final Clock clock;
    private final ScSchedulerProperties properties;
    private final ObjectProvider<OperationalEventSink> events;
    private final TransactionTemplate fresh;
    private final TransactionTemplate effect;
    private final TransactionTemplate outside;
    private final String owner = UUID.randomUUID().toString();

    public OperationalSchedulerService(DataSource source, PlatformTransactionManager manager, Scheduler scheduler,
            RegisteredTaskRegistry registry, Clock clock, ScSchedulerProperties properties,ObjectProvider<OperationalEventSink> events) {
        jdbc = new JdbcTemplate(source); this.scheduler = scheduler; this.registry = registry;
        this.clock = clock; this.properties = properties;
        this.events = events;
        fresh = new TransactionTemplate(manager); fresh.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        effect = new TransactionTemplate(manager); effect.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        outside = new TransactionTemplate(manager); outside.setPropagationBehavior(TransactionDefinition.PROPAGATION_NOT_SUPPORTED);
    }

    public List<RegisteredOperationalTask> registered() { return registry.all(); }
    @Transactional
    public void bootstrapDefaults() {
        if (!properties.isBootstrapDefaults()) return;
        var codes = registry.all().stream().map(RegisteredOperationalTask::jobCode).toList();
        String[] defaults = {"OUTBOX_DISPATCH", "FILE_RECOVERY", "SAFE_RETENTION"};
        String[] crons = {"0 * * * * ?", "0 0/5 * * * ?", "0 0 3 * * ?"};
        for (int index = 0; index < defaults.length; index++) {
            String code = defaults[index]; long id = index + 1L;
            if (!codes.contains(code)) continue;
            if (jdbc.queryForObject("SELECT COUNT(*) FROM operation_schedule WHERE id=? OR job_code=?", Long.class, id, code) > 0) continue;
            var input = new Input(code, crons[index], "UTC", "SKIP", true); validate(input);
            jdbc.update("INSERT INTO operation_schedule(id,job_code,cron,time_zone,misfire_policy,enabled,revision,created_by,created_at,updated_at) VALUES(?,?,?,?,?,TRUE,1,'SYSTEM',?,?)", id,code,crons[index],"UTC","SKIP",utc(now()),utc(now()));
            apply(id,input);
        }
    }
    public void verifySchema() {
        try { jdbc.queryForObject("SELECT COUNT(*) FROM operation_schedule", Long.class);
            jdbc.queryForObject("SELECT COUNT(*) FROM operation_job_run", Long.class);
        } catch (RuntimeException failure) { throw new IllegalStateException("Operational scheduler migration is required"); }
    }

    @Transactional(readOnly = true)
    public Page<Schedule> schedules(int page, int size) {
        bounds(page, size);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM operation_schedule", Long.class);
        var items = jdbc.query("SELECT * FROM operation_schedule ORDER BY id DESC LIMIT ? OFFSET ?", this::schedule, size, (long) page * size);
        return new Page<>(List.copyOf(items), total, page, size);
    }

    @Transactional(readOnly = true)
    public Schedule detail(long id) { return get(id); }

    @Transactional
    public Schedule create(Input input, String actorSubject) {
        validate(input);
        Instant now = now();
        var key = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("INSERT INTO operation_schedule(job_code,cron,time_zone,misfire_policy,enabled,revision,created_by,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?,?)", new String[]{"id"});
            statement.setString(1, input.jobCode()); statement.setString(2, input.cron()); statement.setString(3, input.timeZone());
            statement.setString(4, input.misfirePolicy()); statement.setBoolean(5, input.enabled()); statement.setString(6, actorSubject);
            statement.setObject(7, utc(now)); statement.setObject(8, utc(now)); return statement;
        }, key);
        long id = Objects.requireNonNull(key.getKey()).longValue();
        apply(id, input);
        return get(id);
    }

    @Transactional
    public Schedule update(long id, Input input, int revision) {
        validate(input); var old = get(id);
        if (revision < 1 || old.revision() != revision) throw conflict();
        if (!old.jobCode().equals(input.jobCode())) throw invalid();
        if (old.cron().equals(input.cron()) && old.timeZone().equals(input.timeZone())
                && old.misfirePolicy().equals(input.misfirePolicy()) && old.enabled() == input.enabled()) return old;
        int changed = jdbc.update("UPDATE operation_schedule SET cron=?,time_zone=?,misfire_policy=?,enabled=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
                input.cron(), input.timeZone(), input.misfirePolicy(), input.enabled(), utc(now()), id, revision);
        if (changed != 1) throw conflict();
        apply(id, input); return get(id);
    }

    @Transactional
    public Schedule enabled(long id, boolean enabled, int revision) {
        var old = get(id);
        return update(id, new Input(old.jobCode(), old.cron(), old.timeZone(), old.misfirePolicy(), enabled), revision);
    }

    private void apply(long id, Input input) {
        try {
            var data = new JobDataMap(); data.put("scheduleId", Long.toString(id)); data.put("jobCode", input.jobCode());
            var detail = JobBuilder.newJob(RegisteredTaskDispatcherJob.class).withIdentity(jobKey(input.jobCode()))
                    .usingJobData(data).storeDurably(true).requestRecovery(true).build();
            scheduler.addJob(detail, true);
            scheduler.unscheduleJob(triggerKey(id));
            if (input.enabled()) {
                var cron = CronScheduleBuilder.cronSchedule(input.cron()).inTimeZone(TimeZone.getTimeZone(ZoneId.of(input.timeZone())));
                cron = input.misfirePolicy().equals("SKIP") ? cron.withMisfireHandlingInstructionDoNothing() : cron.withMisfireHandlingInstructionFireAndProceed();
                scheduler.scheduleJob(TriggerBuilder.newTrigger().withIdentity(triggerKey(id)).forJob(detail).withSchedule(cron).build());
            }
        } catch (SchedulerException failure) { throw unavailable(); }
    }

    @Transactional(readOnly = true)
    public Page<Run> runs(int page, int size, Long scheduleId) {
        bounds(page, size); if (scheduleId != null && scheduleId < 1) throw invalid();
        String filter = scheduleId == null ? "" : " WHERE schedule_id=?";
        Object[] args = scheduleId == null ? new Object[]{} : new Object[]{scheduleId};
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM operation_job_run" + filter, Long.class, args);
        var values = new java.util.ArrayList<>(List.of(args)); values.add(size); values.add((long) page * size);
        var items = jdbc.query("SELECT * FROM operation_job_run" + filter + " ORDER BY started_at DESC,id DESC LIMIT ? OFFSET ?", this::run, values.toArray());
        return new Page<>(List.copyOf(items), total, page, size);
    }

    /** 네트워크 작업에는 ambient TX를 남기지 않는다. 성공 효과/이력의 원자성은 모드별로 구분한다. */
    public void execute(String jobCode, long scheduleId, Instant scheduledAt) throws Exception {
        var task = registry.require(jobCode);
        String runKey = UUID.nameUUIDFromBytes((scheduleId + ":" + scheduledAt.toEpochMilli()).getBytes(StandardCharsets.UTF_8)).toString();
        Claim claim = fresh.execute(status -> claim(runKey, jobCode, scheduleId, scheduledAt));
        if (claim == null) { event(OperationalEvent.Outcome.DUPLICATE, runKey); return; }
        var context = new ScheduledRunContext(runKey, jobCode, scheduleId, scheduledAt, claim.attempt());
        try {
            if (task.executionMode() == RegisteredOperationalTask.ExecutionMode.TRANSACTIONAL) {
                effect.executeWithoutResult(status -> { invoke(task, context); complete(runKey, claim.token(), "SUCCESS", null); });
            } else {
                outside.executeWithoutResult(status -> invoke(task, context));
                fresh.executeWithoutResult(status -> complete(runKey, claim.token(), "SUCCESS", null));
            }
            event(OperationalEvent.Outcome.SUCCESS,runKey);
        } catch (RuntimeException failure) {
            fresh.executeWithoutResult(status -> complete(runKey, claim.token(), "FAILED", "JOB_FAILED"));
            event(OperationalEvent.Outcome.FAILURE,runKey);
            throw new OperationalTaskFailure();
        }
    }

    private static void invoke(RegisteredOperationalTask task, ScheduledRunContext context) {
        try { task.execute(context); } catch (Exception failure) { throw new OperationalTaskFailure(); }
    }
    private void event(OperationalEvent.Outcome outcome,String key) { events.ifAvailable(sink->{try{sink.record(new OperationalEvent(OperationalEvent.Kind.SCHEDULE_RUN,outcome,UUID.fromString(key)));}catch(RuntimeException ignored){}}); }

    private Claim claim(String key, String code, long scheduleId, Instant scheduledAt) {
        var schedule = jdbc.query("SELECT job_code,enabled FROM operation_schedule WHERE id=?", (row, index) -> new String[]{row.getString(1), Boolean.toString(row.getBoolean(2))}, scheduleId);
        if (schedule.isEmpty() || !schedule.get(0)[0].equals(code) || !Boolean.parseBoolean(schedule.get(0)[1])) return null;
        String token = UUID.randomUUID().toString(); Instant now = now();
        try {
            jdbc.update("INSERT INTO operation_job_run(schedule_id,run_key,job_code,scheduled_at,started_at,state,attempt,run_owner,execution_token) VALUES(?,?,?,?,?,'RUNNING',1,?,?)",
                    scheduleId, key, code, utc(scheduledAt.truncatedTo(ChronoUnit.MICROS)), utc(now), owner, token);
            return new Claim(token, 1);
        } catch (DuplicateKeyException duplicate) {
            // 현재 프로세스의 중복 실행과 완료된 실행은 폐기한다. 이전 run의 RUNNING만 새 프로세스가 회수한다.
            int claimed = jdbc.update("UPDATE operation_job_run SET run_owner=?,execution_token=?,attempt=attempt+1,started_at=? WHERE run_key=? AND state='RUNNING' AND run_owner<>?", owner, token, utc(now), key, owner);
            return claimed == 1 ? new Claim(token, jdbc.queryForObject("SELECT attempt FROM operation_job_run WHERE run_key=?", Integer.class, key)) : null;
        }
    }

    private void complete(String key, String token, String state, String reason) {
        int updated = jdbc.update("UPDATE operation_job_run SET state=?,reason_code=?,completed_at=? WHERE run_key=? AND execution_token=? AND state='RUNNING'", state, reason, utc(now()), key, token);
        if (updated != 1) throw new OperationalTaskFailure();
    }

    @Transactional
    public int retainFinishedRuns() {
        Instant cutoff = now().minus(properties.getRunRetentionDays(), ChronoUnit.DAYS);
        var ids = jdbc.queryForList("SELECT id FROM operation_job_run WHERE completed_at<? AND state<>'RUNNING' ORDER BY id LIMIT ?", Long.class, utc(cutoff), properties.getRetentionBatchSize());
        int deleted = 0; for (Long id : ids) deleted += jdbc.update("DELETE FROM operation_job_run WHERE id=? AND completed_at<? AND state<>'RUNNING'", id, utc(cutoff));
        return deleted;
    }

    private Schedule get(long id) {
        if (id < 1) throw invalid();
        var rows = jdbc.query("SELECT * FROM operation_schedule WHERE id=?", this::schedule, id);
        if (rows.isEmpty()) throw new ApiException(404, "NOT_FOUND", "예약 작업을 찾을 수 없습니다.");
        return rows.get(0);
    }
    private Schedule schedule(ResultSet row, int index) throws SQLException {
        Date next;
        try { var trigger = scheduler.getTrigger(triggerKey(row.getLong("id"))); next = trigger == null ? null : trigger.getNextFireTime(); }
        catch (SchedulerException failure) { throw unavailable(); }
        return new Schedule(row.getLong("id"), row.getString("job_code"), row.getString("cron"), row.getString("time_zone"), row.getString("misfire_policy"), row.getBoolean("enabled"), row.getInt("revision"), instant(row,"created_at"), instant(row,"updated_at"), next == null ? null : next.toInstant());
    }
    private Run run(ResultSet row, int index) throws SQLException {
        var completed = row.getObject("completed_at", OffsetDateTime.class);
        return new Run(row.getLong("id"), row.getLong("schedule_id"), row.getString("run_key"), row.getString("job_code"), instant(row,"scheduled_at"), instant(row,"started_at"), completed == null ? null : completed.toInstant(), row.getString("state"), row.getString("reason_code"), row.getInt("attempt"));
    }
    private void validate(Input input) {
        if (input == null || input.jobCode() == null || input.cron() == null || input.timeZone() == null || input.misfirePolicy() == null) throw invalid();
        registry.require(input.jobCode());
        if (input.cron().length() > 120 || !input.cron().equals(input.cron().trim()) || !input.cron().split("\\s+")[0].equals("0")
                || input.timeZone().length() > 64 || !ZoneId.getAvailableZoneIds().contains(input.timeZone()) || !List.of("SKIP","FIRE_ONCE").contains(input.misfirePolicy())) throw invalid();
        try {
            var expression = new CronExpression(input.cron()); expression.setTimeZone(TimeZone.getTimeZone(ZoneId.of(input.timeZone())));
            if (expression.getNextValidTimeAfter(Date.from(now())) == null) throw invalid();
        } catch (java.text.ParseException failure) { throw invalid(); }
    }
    public static JobKey jobKey(String code) { return new JobKey(code, GROUP); }
    public static TriggerKey triggerKey(long id) { return new TriggerKey(Long.toString(id), GROUP); }
    public static void bounds(int page, int size) { if (page < 0 || page > 1_000_000 || size < 1 || size > 100) throw invalid(); }
    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MICROS); }
    private static OffsetDateTime utc(Instant value) { return value.atOffset(ZoneOffset.UTC); }
    private static Instant instant(ResultSet row, String field) throws SQLException { return row.getObject(field, OffsetDateTime.class).toInstant(); }
    private static ApiException invalid() { return new ApiException(400,"INVALID_INPUT","예약 작업 입력을 확인해 주세요."); }
    private static ApiException conflict() { return new ApiException(409,"REVISION_CONFLICT","다른 변경을 확인하고 다시 저장해 주세요."); }
    private static ApiException unavailable() { return new ApiException(503,"SCHEDULER_UNAVAILABLE","예약 작업 서비스에 연결하지 못했습니다."); }
    private record Claim(String token, int attempt) {}
    private static final class OperationalTaskFailure extends RuntimeException { OperationalTaskFailure(){super("Operational task failed");} }
    public record Input(String jobCode, String cron, String timeZone, String misfirePolicy, boolean enabled) {}
    public record Schedule(long id,String jobCode,String cron,String timeZone,String misfirePolicy,boolean enabled,int revision,Instant createdAt,Instant updatedAt,Instant nextFireAt) {}
    public record Run(long id,long scheduleId,String runKey,String jobCode,Instant scheduledAt,Instant startedAt,Instant completedAt,String state,String reasonCode,int attempt) {}
    public record Page<T>(List<T> items,long total,int page,int size) {}
}
