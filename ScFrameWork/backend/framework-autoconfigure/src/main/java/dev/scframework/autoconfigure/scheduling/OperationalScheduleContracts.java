package dev.scframework.autoconfigure.scheduling;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

public final class OperationalScheduleContracts {
    private OperationalScheduleContracts(){}
    @Schema(name="OperationalRegisteredJobResponse")
    public record RegisteredJob(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String jobCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"TRANSACTIONAL","NON_TRANSACTIONAL"}) String executionMode){}
    @Schema(name="OperationalRegisteredJobsResponse") public record RegisteredJobs(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<RegisteredJob> items){}
    @Schema(name="OperationalScheduleInput") public record Input(
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,maxLength=64) String jobCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,maxLength=120,description="Quartz cron. seconds 필드는 0만 허용합니다.") String cron,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,maxLength=64) String timeZone,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"SKIP","FIRE_ONCE"}) String misfirePolicy,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Boolean enabled){}
    @Schema(name="OperationalScheduleUpdateInput") public record UpdateInput(
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,maxLength=64) String jobCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,maxLength=120) String cron,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,maxLength=64) String timeZone,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"SKIP","FIRE_ONCE"}) String misfirePolicy,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Boolean enabled,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1") Integer revision){}
    @Schema(name="OperationalScheduleRevisionInput") public record RevisionInput(@Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1") Integer revision){}
    @Schema(name="OperationalScheduleResponse") public record Schedule(
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) long id,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String jobCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String cron,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String timeZone,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"SKIP","FIRE_ONCE"}) String misfirePolicy,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) boolean enabled,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) int revision,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Instant createdAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Instant updatedAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,nullable=true) Instant nextFireAt){}
    @Schema(name="OperationalSchedulePage") public record SchedulePage(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<Schedule> items,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) long total,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0",maximum="1000000") int page,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1",maximum="100") int size){}
    @Schema(name="OperationalRunResponse") public record Run(
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) long id,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) long scheduleId,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,format="uuid") String runKey,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String jobCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Instant scheduledAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Instant startedAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,nullable=true) Instant completedAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"RUNNING","SUCCESS","FAILED"}) String state,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,nullable=true) String reasonCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1") int attempt){}
    @Schema(name="OperationalRunPage") public record RunPage(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<Run> items,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) long total,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0",maximum="1000000") int page,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1",maximum="100") int size){}
    public static Schedule response(OperationalSchedulerService.Schedule value){return new Schedule(value.id(),value.jobCode(),value.cron(),value.timeZone(),value.misfirePolicy(),value.enabled(),value.revision(),value.createdAt(),value.updatedAt(),value.nextFireAt());}
    public static SchedulePage response(OperationalSchedulerService.Page<OperationalSchedulerService.Schedule> value){return new SchedulePage(value.items().stream().map(OperationalScheduleContracts::response).toList(),value.total(),value.page(),value.size());}
    public static RunPage runs(OperationalSchedulerService.Page<OperationalSchedulerService.Run> value){return new RunPage(value.items().stream().map(row->new Run(row.id(),row.scheduleId(),row.runKey(),row.jobCode(),row.scheduledAt(),row.startedAt(),row.completedAt(),row.state(),row.reasonCode(),row.attempt())).toList(),value.total(),value.page(),value.size());}
}
