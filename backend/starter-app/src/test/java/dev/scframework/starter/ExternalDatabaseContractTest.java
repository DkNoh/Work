package dev.scframework.starter;

import dev.scframework.autoconfigure.audit.JdbcSecurityAuditSink;
import dev.scframework.autoconfigure.database.JdbcDuplicateInsert;
import dev.scframework.autoconfigure.database.StandardDatabaseDialect;
import dev.scframework.autoconfigure.messaging.JdbcMessageStore;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.messaging.ScMessage;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.quartz.impl.jdbcjobstore.DriverDelegate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * 실제 외부 DB를 준비한 운영자가 명시적으로 선택하는 공통 JDBC 계약 시험이다.
 * 기본 빌드에서는 skip하며 H2 호환 모드를 Oracle/Db2/SQL Server/PostgreSQL의 실DB로 취급하지 않는다.
 * SC_DB_CONTRACT_TEST=true, SC_TEST_DB_DISPOSABLE=true와 SC_TEST_DB_VENDOR/URL/USERNAME/PASSWORD,
 * SC_TEST_DB_SCHEMA=sc_contract_*가 필요하다. 운영 DB 또는 실제 고객 자료를 대상으로 실행하지 않는다.
 * DBA가 만든 빈 전용 schema를 접속 사용자의 기본 schema로 설정한 후 실행한다.
 * 이 시험은 그 schema에 앱 소유 audit/operations DDL과 합성 자료를 만들며, 종료 때 자동 삭제하지 않는다.
 * URL/계정/비밀번호를 출력하지 않는다. 정상 실행 뒤 남은 schema는 담당자가 확인하고 별도 회수한다.
 */
@EnabledIfEnvironmentVariable(named = "SC_DB_CONTRACT_TEST", matches = "true")
class ExternalDatabaseContractTest {
    private static final Set<String> EXTERNAL_VENDORS = Set.of("oracle", "db2", "sqlserver", "postgresql");
    private static final Map<String, String> DELEGATES = Map.of(
            "oracle", "org.quartz.impl.jdbcjobstore.oracle.OracleDelegate",
            "db2", "org.quartz.impl.jdbcjobstore.DB2v8Delegate",
            "sqlserver", "org.quartz.impl.jdbcjobstore.MSSQLDelegate",
            "postgresql", "org.quartz.impl.jdbcjobstore.PostgreSQLDelegate");

    @Test
    void externalDatabasePreservesMigrationPagingSavepointAndDmlContracts() {
        // 실수로 기존 schema를 대상으로 삼지 않도록 접속 전 명시적인 별도 입력을 요구한다.
        assertThat(required("SC_TEST_DB_DISPOSABLE")).as("전용 폐기 가능 DB/schema 확인").isEqualTo("true");
        String vendor = required("SC_TEST_DB_VENDOR").toLowerCase(Locale.ROOT);
        assertThat(EXTERNAL_VENDORS).as("외부 DB만 허용하며 H2 실행과 구분").contains(vendor);
        String schema = required("SC_TEST_DB_SCHEMA");
        assertThat(schema.matches("(?i)sc_contract_[a-z0-9_]+"))
                .as("SC_TEST_DB_SCHEMA는 sc_contract_ 접두사를 가진 전용 schema여야 함").isTrue();
        var source = new DriverManagerDataSource(required("SC_TEST_DB_URL"),
                required("SC_TEST_DB_USERNAME"), required("SC_TEST_DB_PASSWORD"));

        try {
            String actualSchema = requireEmptyDefaultSchema(source, schema);
            var dialect = StandardDatabaseDialect.detect(source);
            assertThat(dialect.id()).as("실제 JDBC metadata와 선택 vendor 일치").isEqualTo(vendor);

            // 공통 라이브러리가 DDL을 만들지 않는다. 소비 앱의 실제 세 migration을 적용한다.
            // Flyway clean/baseline은 사용하지 않아 기존 자료를 지우거나 기존 schema를 승인하지 않는다.
            // Flyway의 기본 접속 안내 로그도 URL을 포함하므로 이 전용 시험에서는 logger 목록을 비운다.
            var flyway = Flyway.configure().loggers(new String[0]).dataSource(source).defaultSchema(actualSchema)
                    .schemas(actualSchema).createSchemas(false).cleanDisabled(true)
                    .locations("classpath:db/" + vendor + "/audit-migration",
                            "classpath:db/" + vendor + "/operations-migration")
                    .load();
            assertThat(flyway.migrate().migrationsExecuted).as("audit 1개와 operations 2개 DDL 실행").isEqualTo(3);
            flyway.validate();
            assertThat(flyway.migrate().migrationsExecuted).as("같은 이력의 재실행은 DDL을 반복하지 않음").isZero();

            var jdbc = new JdbcTemplate(source);
            var tx = new TransactionTemplate(new DataSourceTransactionManager(source));
            var duplicate = new JdbcDuplicateInsert(source);
            var store = new JdbcMessageStore(source, dialect);
            var audit = new JdbcSecurityAuditSink(source, dialect);
            Instant now = Instant.parse("2026-01-02T03:04:05.123456Z");

            // 한글 payload, UUID 문자열, nullable 완료 시각과 마이크로초 단위를 실제 드라이버로 왕복한다.
            var message = new ScMessage(UUID.randomUUID(), "DATABASE_CONTRACT", 1, now, "{\"label\":\"한글 계약\"}");
            tx.executeWithoutResult(status -> {
                store.enqueue(message);
                audit.save(new SecurityAuditEvent("contract", null, now, "DB_CONTRACT", "SUCCESS",
                        "DATABASE", "fixture", "contract-request", "OK"));
            });
            assertThat(store.known(message)).isTrue();
            assertThat(store.find(message.eventId()).createdAt()).isEqualTo(now);
            assertThat(store.find(message.eventId()).completedAt()).isNull();
            assertThat(store.page(null, null, 0, 1).items()).hasSize(1);
            assertThat(store.page(null, null, 1, 1).items()).isEmpty();
            assertThat(jdbc.queryForObject("SELECT payload FROM sc_message_outbox WHERE event_id=?",
                    String.class, message.eventId().toString())).isEqualTo(message.payload());
            assertThat(jdbc.queryForObject("SELECT id FROM security_audit_event", Long.class)).isPositive();

            // 공통 savepoint 구현이 PostgreSQL의 aborted TX 등 실드라이버 동작을 복구하는지 검증한다.
            // 중복 이전 DML은 보존되고, 외부 트랜잭션 rollback은 그 앞뒤의 DML을 모두 되돌려야 한다.
            String existing = UUID.randomUUID().toString();
            String before = UUID.randomUUID().toString();
            String after = UUID.randomUUID().toString();
            jdbc.update("INSERT INTO operation_pulse_effect(run_key,occurred_at) VALUES(?,?)", existing, dialect.timestamp(now));
            tx.executeWithoutResult(status -> {
                jdbc.update("INSERT INTO operation_pulse_effect(run_key,occurred_at) VALUES(?,?)", before, dialect.timestamp(now));
                assertThat(duplicate.insert(() -> jdbc.update(
                        "INSERT INTO operation_pulse_effect(run_key,occurred_at) VALUES(?,?)", existing, dialect.timestamp(now)))).isFalse();
                assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_pulse_effect", Long.class)).isEqualTo(2L);
                assertThat(duplicate.insert(() -> jdbc.update(
                        "INSERT INTO operation_pulse_effect(run_key,occurred_at) VALUES(?,?)", after, dialect.timestamp(now)))).isTrue();
                status.setRollbackOnly();
            });
            assertThat(jdbc.queryForList("SELECT run_key FROM operation_pulse_effect", String.class)).containsExactly(existing);
            tx.executeWithoutResult(status -> {
                assertThat(duplicate.insert(() -> jdbc.update(
                        "INSERT INTO operation_pulse_effect(run_key,occurred_at) VALUES(?,?)", existing, dialect.timestamp(now)))).isFalse();
                jdbc.update("INSERT INTO operation_pulse_effect(run_key,occurred_at) VALUES(?,?)", after, dialect.timestamp(now));
            });
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_pulse_effect", Long.class)).isEqualTo(2L);
            Instant storedTime = jdbc.queryForObject("SELECT occurred_at FROM operation_pulse_effect WHERE run_key=?",
                    (row, index) -> dialect.readInstant(row, "occurred_at"), after);
            assertThat(storedTime).isEqualTo(now);

            // 실제 outbox/inbox 저장·완료 SQL도 검증한다. RabbitMQ 전달/프로세스 crash 시험은 별도다.
            assertThat(store.due(now, 5, 1)).containsExactly(message.eventId());
            var delivery = store.claim(message.eventId(), now, now.plusSeconds(30), 5);
            assertThat(delivery).isNotNull();
            assertThat(delivery.message().payload()).isEqualTo(message.payload());
            store.published(delivery, now);
            tx.executeWithoutResult(status -> {
                store.insertInbox("db-contract", message, now);
                store.complete(message.eventId(), now);
            });
            assertThat(store.processed("db-contract", message.eventId())).isTrue();
            assertThat(store.find(message.eventId()).state()).isEqualTo(JdbcMessageStore.State.COMPLETED);

            // 선택한 Quartz delegate의 로딩과 앱 DDL의 핵심 테이블 접근을 확인한다.
            // 이 검사는 Quartz job 실행·클러스터 잠금·재시작 복구까지 검증했다고 주장하지 않는다.
            assertThat(dialect.quartzDelegateClassName()).isEqualTo(DELEGATES.get(vendor));
            assertThat(DriverDelegate.class.isAssignableFrom(Class.forName(dialect.quartzDelegateClassName()))).isTrue();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM QRTZ_JOB_DETAILS", Long.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM QRTZ_TRIGGERS", Long.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_group", Long.class)).isZero();
        } catch (Exception failure) {
            // JDBC/Flyway 예외 메시지에는 접속 URL/계정이 들어갈 수 있어 클래스와 SQLState만 보고한다.
            // 합성 SQL 계약의 상세 진단은 테스트 전용 DB 측 로그로 확인한다.
            String sqlState = "none";
            for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
                if (cause instanceof SQLException sql) { sqlState = sql.getSQLState(); break; }
            }
            fail("External DB contract failed: " + failure.getClass().getSimpleName() + ", SQLState=" + sqlState);
        }
    }

    private static String requireEmptyDefaultSchema(DriverManagerDataSource source, String requestedSchema) throws SQLException {
        try (Connection connection = source.getConnection()) {
            String actualSchema = connection.getSchema();
            assertThat(actualSchema != null && actualSchema.equalsIgnoreCase(requestedSchema))
                    .as("접속 사용자의 기본 schema를 전용 SC_TEST_DB_SCHEMA로 먼저 설정해야 함").isTrue();
            var metadata = connection.getMetaData();
            assertThat(metadata.supportsTransactions()).as("로컬 트랜잭션 지원").isTrue();
            assertThat(metadata.supportsSavepoints()).as("중복 INSERT 복구용 savepoint 지원").isTrue();
            String escape = metadata.getSearchStringEscape();
            String schemaPattern = actualSchema.replace(escape, escape + escape)
                    .replace("_", escape + "_").replace("%", escape + "%");
            try (var tables = metadata.getTables(connection.getCatalog(), schemaPattern, "%", new String[]{"TABLE"})) {
                assertThat(tables.next()).as("기존 테이블이 있는 schema에는 migration을 실행하지 않음").isFalse();
            }
            return actualSchema;
        }
    }

    private static String required(String name) {
        String value = System.getenv(name);
        assertThat(value != null && !value.isBlank()).as(name + " 환경 변수 필요").isTrue();
        return value;
    }
}
