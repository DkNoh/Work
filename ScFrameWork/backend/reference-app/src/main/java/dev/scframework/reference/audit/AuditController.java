package dev.scframework.reference.audit;

import dev.scframework.core.ApiException;
import dev.scframework.reference.identity.ActorResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 신규 ADMIN 확장 API. 과거 session authority 대신 현재 DB 역할을 확인한다. */
@RestController
@ConditionalOnProperty(prefix = "sc.framework.audit", name = "enabled", havingValue = "true")
public class AuditController {
    private final ActorResolver actors;
    private final JdbcTemplate jdbc;

    public AuditController(ActorResolver actors, DataSource dataSource) {
        this.actors = actors;
        jdbc = new JdbcTemplate(dataSource);
    }

    @GetMapping("/api/audit/events")
    @Operation(summary = "보안 감사 조회", description = "현재 DB ADMIN만 접근하는 신규 감사 API. 최신 시각/ID순이며 본문·암호·토큰을 반환하지 않습니다.")
    public AuditPage events(@Parameter(hidden = true) Authentication authentication,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String action, @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String actorSubject,
            @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to) {
        actors.requireAdmin(actors.require(authentication));
        if (page < 0 || page > 1_000_000 || size < 1 || size > 100) throw invalid();
        if (action != null && !action.matches("[A-Z][A-Z0-9_]{0,63}")) throw invalid();
        if (outcome != null && !List.of("SUCCESS", "FAILURE", "DENIED").contains(outcome)) throw invalid();
        if (actorSubject != null && !actorSubject.matches("[A-Za-z0-9._@-]{1,64}")) throw invalid();
        if (from != null && to != null && from.isAfter(to)) throw invalid();
        StringBuilder filter = new StringBuilder(" WHERE 1 = 1");
        List<Object> values = new ArrayList<>();
        if (action != null) { filter.append(" AND action = ?"); values.add(action); }
        if (outcome != null) { filter.append(" AND outcome = ?"); values.add(outcome); }
        if (actorSubject != null) { filter.append(" AND actor_subject = ?"); values.add(actorSubject); }
        if (from != null) { filter.append(" AND occurred_at >= ?"); values.add(from.atOffset(java.time.ZoneOffset.UTC)); }
        if (to != null) { filter.append(" AND occurred_at <= ?"); values.add(to.atOffset(java.time.ZoneOffset.UTC)); }
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event" + filter, Long.class, values.toArray());
        List<Object> pageValues = new ArrayList<>(values);
        pageValues.add(size);
        pageValues.add((long) page * size);
        List<AuditItem> items = jdbc.query("SELECT * FROM security_audit_event" + filter
                + " ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?", AuditController::item, pageValues.toArray());
        return new AuditPage(List.copyOf(items), count == null ? 0 : count, page, size);
    }

    private static AuditItem item(ResultSet row, int index) throws SQLException {
        return new AuditItem(row.getLong("id"), row.getString("actor_subject"),
                row.getObject("actor_id", Long.class), row.getObject("occurred_at", OffsetDateTime.class).toInstant(),
                row.getString("action"), row.getString("outcome"), row.getString("resource_type"),
                row.getString("resource_id"), row.getString("request_id"), row.getString("reason_code"));
    }

    private static ApiException invalid() { return new ApiException(400, "INVALID_INPUT", "감사 조회 조건을 확인해 주세요."); }

    public record AuditPage(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AuditItem> items,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "0") long total,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "0", maximum = "1000000") int page,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1", maximum = "100") int size) {}
    public record AuditItem(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1") long id,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64, pattern = "[A-Za-z0-9._@-]{1,64}") String actorSubject,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true, minimum = "1") Long actorId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant occurredAt,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64, pattern = "[A-Z][A-Z0-9_]{0,63}") String action,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"SUCCESS", "FAILURE", "DENIED"}) String outcome,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 32, pattern = "[A-Z][A-Z0-9_]{0,31}") String resourceType,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true, maxLength = 128, pattern = "[A-Za-z0-9._:-]{1,128}") String resourceId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true, maxLength = 64, pattern = "[A-Za-z0-9_-]{1,64}") String requestId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true, maxLength = 64, pattern = "[A-Z][A-Z0-9_]{0,63}") String reasonCode) {}
}
