package dev.scframework.core.scheduling;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.UUID;

public record ScheduledRunContext(String runKey, String jobCode, long scheduleId, Instant scheduledAt, int attempt) {
    public ScheduledRunContext {
        Objects.requireNonNull(runKey); Objects.requireNonNull(jobCode); Objects.requireNonNull(scheduledAt);
        if (!UUID.fromString(runKey).toString().equals(runKey) || !jobCode.matches("[A-Z][A-Z0-9_]{0,63}")
                || scheduleId < 1 || attempt < 1) throw new IllegalArgumentException("Invalid scheduled run context");
        scheduledAt = scheduledAt.truncatedTo(ChronoUnit.MICROS);
    }
}
