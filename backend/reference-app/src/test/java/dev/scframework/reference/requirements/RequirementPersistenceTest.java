package dev.scframework.reference.requirements;

import static org.assertj.core.api.Assertions.*;

import java.nio.file.Path;
import java.sql.*;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RequirementPersistenceTest {
    @TempDir Path directory;
    private String url(String name) { return "jdbc:h2:file:" + directory.resolve(name).toAbsolutePath() + ";DB_CLOSE_ON_EXIT=FALSE"; }
    private Flyway migrations(String url) { return Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration").load(); }

    @Test void upgradingExistingV1PreservesExamplesAndNewRequirementBigintAndUtcPrecisionOnReopen() throws Exception {
        String url = url("upgrade");
        assertThat(Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration").target("1").load().migrate().migrationsExecuted).isEqualTo(1);
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            connection.createStatement().executeUpdate("INSERT INTO example_entry(id,title,revision) VALUES(5000000000,'V1 preserved',7)");
        }
        assertThat(Flyway.configure().dataSource(url,"sa","").locations("classpath:db/migration").target("3").load().migrate().migrationsExecuted).isEqualTo(2);
        assertThat(migrations(url).migrate().migrationsExecuted).isGreaterThanOrEqualTo(1);
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) { seed(connection); }
        assertThat(migrations(url).migrate().migrationsExecuted).isZero();
        try (Connection connection = DriverManager.getConnection(url, "sa", ""); Statement statement = connection.createStatement()) {
            try (ResultSet row = statement.executeQuery("SELECT id,title,revision FROM example_entry")) { assertThat(row.next()).isTrue(); assertThat(row.getLong("id")).isEqualTo(5_000_000_000L); assertThat(row.getInt("revision")).isEqualTo(7); }
            try (ResultSet row = statement.executeQuery("SELECT id,author_id,assigned_reviewer_id,created_at,updated_at,revision FROM requirement_entry")) {
                assertThat(row.next()).isTrue(); assertThat(row.getLong("id")).isEqualTo(5_000_000_003L); assertThat(row.getLong("author_id")).isEqualTo(5_000_000_000L); assertThat(row.getLong("assigned_reviewer_id")).isEqualTo(5_000_000_001L);
                assertThat(row.getObject("created_at", OffsetDateTime.class).toInstant()).isEqualTo(Instant.parse("2026-10-06T12:34:56.123456Z"));
                assertThat(row.getObject("updated_at", OffsetDateTime.class).toInstant()).isEqualTo(Instant.parse("2026-10-06T12:34:56.123456Z")); assertThat(row.getInt("revision")).isEqualTo(1);
            }
        }
    }

    @Test void realMigrationRejectsDuplicateForeignKeysInvalidFlagsStatusAndUnsupportedScreenVersion() throws Exception {
        String url = url("constraints"); migrations(url).migrate();
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            seed(connection);
            try (Statement statement = connection.createStatement()) {
                statement.executeUpdate("INSERT INTO requirement_review(requirement_id,decision,rationale,conditions,scope,exclusions,acceptance,estimate,reviewer_id,updated_at) VALUES(5000000003,'POSSIBLE','reason','','scope','none','done','SMALL',5000000001,CURRENT_TIMESTAMP)");
            }
            for (String sql : new String[] {
                    "UPDATE reference_user SET username='sql-author' WHERE id=5000000001",
                    "UPDATE reference_user SET role='OWNER' WHERE id=5000000000",
                    "UPDATE menu_entry SET parent_id=999 WHERE id=5000000002",
                    "UPDATE menu_entry SET active=2 WHERE id=5000000002",
                    "UPDATE requirement_entry SET menu_id=999 WHERE id=5000000003",
                    "UPDATE requirement_entry SET author_id=999 WHERE id=5000000003",
                    "UPDATE requirement_entry SET assigned_reviewer_id=999 WHERE id=5000000003",
                    "UPDATE requirement_entry SET revision=0 WHERE id=5000000003",
                    "UPDATE requirement_entry SET similar=2 WHERE id=5000000003",
                    "UPDATE requirement_entry SET status='UNKNOWN' WHERE id=5000000003",
                    "UPDATE requirement_entry SET screen_version_id=1 WHERE id=5000000003",
                    "UPDATE requirement_review SET decision='UNKNOWN' WHERE requirement_id=5000000003",
                    "UPDATE requirement_review SET estimate='HUGE' WHERE requirement_id=5000000003",
                    "UPDATE requirement_review SET reviewer_id=999 WHERE requirement_id=5000000003",
                    "UPDATE requirement_review SET requirement_id=999 WHERE requirement_id=5000000003",
                    "INSERT INTO requirement_review SELECT * FROM requirement_review WHERE requirement_id=5000000003",
                    "INSERT INTO requirement_comment(requirement_id,body,author_id,created_at) VALUES(999,'missing request',5000000000,CURRENT_TIMESTAMP)",
                    "INSERT INTO requirement_comment(requirement_id,body,author_id,created_at) VALUES(5000000003,'missing author',999,CURRENT_TIMESTAMP)",
                    "INSERT INTO requirement_history(requirement_id,action,after_json,actor_id,created_at) VALUES(5000000003,'CREATE','{}',999,CURRENT_TIMESTAMP)"
            }) {
                assertThatThrownBy(() -> { try (Statement statement = connection.createStatement()) { statement.executeUpdate(sql); } }).isInstanceOf(SQLException.class);
            }
            try (Statement statement = connection.createStatement(); ResultSet row = statement.executeQuery("SELECT revision,similar,screen_version_id FROM requirement_entry WHERE id=5000000003")) { assertThat(row.next()).isTrue(); assertThat(row.getInt("revision")).isEqualTo(1); assertThat(row.getInt("similar")).isZero(); assertThat(row.getObject("screen_version_id")).isNull(); }
        }
    }

    private void seed(Connection connection) throws SQLException {
        OffsetDateTime timestamp = Instant.parse("2026-10-06T12:34:56.123456Z").atOffset(ZoneOffset.UTC);
        try (PreparedStatement user = connection.prepareStatement("INSERT INTO reference_user(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)")) {
            user.setLong(1, 5_000_000_000L); user.setString(2, "sql-author"); user.setString(3, "합성 작성자"); user.setString(4, "non-authentication-sql-fixture"); user.setString(5, "REQUESTER"); user.setObject(6, timestamp); user.executeUpdate();
            user.setLong(1, 5_000_000_001L); user.setString(2, "sql-reviewer"); user.setString(3, "합성 검토자"); user.setString(5, "REVIEWER"); user.executeUpdate();
        }
        try (PreparedStatement menu = connection.prepareStatement("INSERT INTO menu_entry(id,name,sort_order,active) VALUES(5000000002,?,0,1)")) { menu.setString(1, "합성 메뉴"); menu.executeUpdate(); }
        try (PreparedStatement request = connection.prepareStatement("INSERT INTO requirement_entry(id,menu_id,title,desired,reason,reference_text,similar,follow_parts,status,revision,author_id,assigned_reviewer_id,created_at,updated_at) VALUES(5000000003,5000000002,?,?,?,'',0,'','DRAFT',1,5000000000,5000000001,?,?)")) {
            request.setString(1, "합성 요청"); request.setString(2, "합성 내용"); request.setString(3, "합성 이유"); request.setObject(4, timestamp); request.setObject(5, timestamp); request.executeUpdate();
        }
    }
}
