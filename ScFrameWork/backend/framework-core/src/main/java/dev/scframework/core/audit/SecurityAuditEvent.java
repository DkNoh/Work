package dev.scframework.core.audit;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.Set;

/** 감사에는 식별자·결과 코드만 담는다. 요청 본문·암호·토큰·SQL·예외 내용은 받지 않는다. */
public record SecurityAuditEvent(String actorSubject, Long actorId, Instant occurredAt,
        String action, String outcome, String resourceType, String resourceId,
        String requestId, String reasonCode) {
    private static final Set<String> OUTCOMES = Set.of("SUCCESS", "FAILURE", "DENIED");

    public SecurityAuditEvent {
        required(actorSubject, "[A-Za-z0-9._@-]{1,64}", "actor subject");
        if (actorId != null && actorId < 1) throw new IllegalArgumentException("Invalid audit actor ID");
        occurredAt = Objects.requireNonNull(occurredAt, "Audit occurrence time is required")
                .truncatedTo(ChronoUnit.MICROS);
        required(action, "[A-Z][A-Z0-9_]{0,63}", "action");
        if (outcome == null || !OUTCOMES.contains(outcome)) throw new IllegalArgumentException("Invalid audit outcome");
        required(resourceType, "[A-Z][A-Z0-9_]{0,31}", "resource type");
        optional(resourceId, "[A-Za-z0-9._:-]{1,128}", "resource ID");
        optional(requestId, "[A-Za-z0-9_-]{1,64}", "request ID");
        optional(reasonCode, "[A-Z][A-Z0-9_]{0,63}", "reason code");
    }

    private static void required(String value, String pattern, String field) {
        if (value == null || !value.matches(pattern))
            throw new IllegalArgumentException("Invalid audit " + field);
    }

    private static void optional(String value, String pattern, String field) {
        if (value != null) required(value, pattern, field);
    }
}
