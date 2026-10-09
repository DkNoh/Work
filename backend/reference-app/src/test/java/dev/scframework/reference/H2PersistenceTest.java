package dev.scframework.reference;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class H2PersistenceTest {
    @TempDir Path directory;

    @Test
    void appOwnedBaselineSurvivesFileDatabaseReopenAndPreservesBigintIds() throws Exception {
        String url = "jdbc:h2:file:" + directory.resolve("isolated-reference").toAbsolutePath() + ";DB_CLOSE_ON_EXIT=FALSE";
        var baseline = Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration").target("3").load();
        assertThat(baseline.migrate().migrationsExecuted).isEqualTo(3);
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.prepareStatement("INSERT INTO example_entry(id, title, revision) VALUES (?, ?, ?)")) {
            statement.setLong(1, 5_000_000_000L);
            statement.setString(2, "isolated persistence fixture");
            statement.setInt(3, 7);
            assertThat(statement.executeUpdate()).isEqualTo(1);
        }
        var flyway = Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration").load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(2);
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement();
                var row = statement.executeQuery("SELECT id, title, revision FROM example_entry")) {
            assertThat(row.next()).isTrue();
            assertThat(row.getLong("id")).isEqualTo(5_000_000_000L);
            assertThat(row.getString("title")).isEqualTo("isolated persistence fixture");
            assertThat(row.getInt("revision")).isEqualTo(7);
            assertThat(row.next()).isFalse();
        }
    }
}
