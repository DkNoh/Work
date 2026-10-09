package dev.scframework.core.scheduling;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.UUID;

/*
 * 예약 실행 한 번의 식별 정보다. 동일 예약/예정 시각으로 만든 runKey가 중복 실행 판별에 사용된다.
 * 생성자는 UUID·작업 코드·양의 ID/시도 횟수를 검사하며 시각을 마이크로초로 맞춘다.
 */

public record ScheduledRunContext(String runKey, String jobCode, long scheduleId, Instant scheduledAt, int attempt) {
    public ScheduledRunContext {
        Objects.requireNonNull(runKey); Objects.requireNonNull(jobCode); Objects.requireNonNull(scheduledAt);
        if (!UUID.fromString(runKey).toString().equals(runKey) || !jobCode.matches("[A-Z][A-Z0-9_]{0,63}")
                || scheduleId < 1 || attempt < 1) throw new IllegalArgumentException("Invalid scheduled run context");
        scheduledAt = scheduledAt.truncatedTo(ChronoUnit.MICROS);
    }
}
