package dev.scframework.core.audit;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class SecurityAuditEventTest {
    @Test void acceptsAnonymousAndNullableIdentityWithoutApplicationDependencies() {
        var event = new SecurityAuditEvent("ANONYMOUS", null, Instant.parse("2026-10-06T00:00:00.123456789Z"),
                "AUTH_LOGIN", "FAILURE", "HTTP", null, "req-1", "AUTH_FAILED");
        assertNull(event.actorId());
        assertEquals(Instant.parse("2026-10-06T00:00:00.123456Z"), event.occurredAt());
    }

    @Test void rejectsUnboundedOrStructuredValuesWithoutRepeatingSubmittedContent() {
        String canary = "synthetic-private-input\nnot-for-audit";
        var error = assertThrows(IllegalArgumentException.class, () -> new SecurityAuditEvent(canary,
                null, Instant.EPOCH, "AUTH_LOGIN", "FAILURE", "HTTP", null, null, null));
        assertFalse(error.getMessage().contains(canary));
        assertThrows(IllegalArgumentException.class, () -> event("a".repeat(65), "SUCCESS", null));
        assertThrows(IllegalArgumentException.class, () -> event("user", "UNKNOWN", null));
        assertThrows(IllegalArgumentException.class, () -> event("user", "SUCCESS", "{\"body\":1}"));
        assertThrows(IllegalArgumentException.class, () -> new SecurityAuditEvent("user", 0L,
                Instant.EPOCH, "AUTH_LOGIN", "SUCCESS", "HTTP", null, null, null));
    }

    private SecurityAuditEvent event(String subject, String outcome, String resource) {
        return new SecurityAuditEvent(subject, null, Instant.EPOCH, "AUTH_LOGIN", outcome, "HTTP", resource, null, null);
    }
}
