package dev.scframework.autoconfigure.audit;

import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditSink;
import java.time.ZoneOffset;
import javax.sql.DataSource;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

/*
 * 공통 감사 DTO를 security_audit_event에 INSERT하는 JDBC 저장 어댑터다.
 * 생성자는 SELECT만으로 스키마 존재를 확인한다. 생성/변경 DDL은 앱 Flyway가 수행하고 시각은 UTC로 바인딩한다.
 */

/** 중립 H2 adapter. 테이블 migration은 소비 앱이 소유하며 라이브러리는 DDL을 실행하지 않는다. */
public final class JdbcSecurityAuditSink implements SecurityAuditSink {
    private final JdbcTemplate jdbc;

    public JdbcSecurityAuditSink(DataSource dataSource) {
        jdbc = new JdbcTemplate(dataSource);
        try {
            jdbc.queryForList("SELECT id FROM security_audit_event WHERE 1 = 0");
        } catch (DataAccessException exception) {
            throw new IllegalStateException("Audit storage schema is missing or unavailable");
        }
    }

    @Override public void save(SecurityAuditEvent event) {
        jdbc.update("""
                INSERT INTO security_audit_event
                (actor_subject, actor_id, occurred_at, action, outcome, resource_type, resource_id, request_id, reason_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, event.actorSubject(), event.actorId(), event.occurredAt().atOffset(ZoneOffset.UTC),
                event.action(), event.outcome(), event.resourceType(), event.resourceId(),
                event.requestId(), event.reasonCode());
    }
}
