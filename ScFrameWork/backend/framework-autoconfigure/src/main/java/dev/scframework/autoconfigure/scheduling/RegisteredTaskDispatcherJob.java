package dev.scframework.autoconfigure.scheduling;

import java.time.Instant;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

/** 같은 jobCode는 항상 같은 JobKey로 등록하여 겹치는 실행을 막는다. */
@DisallowConcurrentExecution
public final class RegisteredTaskDispatcherJob implements Job {
    private final OperationalSchedulerService service;
    public RegisteredTaskDispatcherJob(OperationalSchedulerService service) { this.service = service; }
    @Override public void execute(JobExecutionContext context) throws JobExecutionException {
        try {
            String jobCode = context.getJobDetail().getJobDataMap().getString("jobCode");
            long scheduleId = Long.parseLong(context.getJobDetail().getJobDataMap().getString("scheduleId"));
            Instant scheduledAt = context.getScheduledFireTime().toInstant();
            // 복구 trigger는 원래 예약 시각을 문자열로 보존한다. 사용자 입력 data map은 받지 않는다.
            Object original = context.getMergedJobDataMap().get(org.quartz.Scheduler.FAILED_JOB_ORIGINAL_TRIGGER_SCHEDULED_FIRETIME_IN_MILLISECONDS);
            if (context.isRecovering() && original != null) scheduledAt = Instant.ofEpochMilli(Long.parseLong(original.toString()));
            service.execute(jobCode, scheduleId, scheduledAt);
        } catch (Exception failure) {
            // Quartz 기본 로그에도 Throwable 원문/원격 URL/업무 내용을 넘기지 않는다.
            throw new JobExecutionException("Operational task failed", false);
        }
    }
}
