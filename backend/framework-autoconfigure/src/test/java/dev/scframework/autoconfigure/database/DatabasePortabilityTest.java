package dev.scframework.autoconfigure.database;

import dev.scframework.autoconfigure.ScDatabaseAutoConfiguration;
import dev.scframework.core.database.DatabaseDialect;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.TimeZone;
import java.util.UUID;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.*;

/** DB 제품 선택/확장 계약을 검사한다. H2에서 SQL을 실행한 결과는 외부 제품 실기동 인증이 아니다. */
class DatabasePortabilityTest {
    @ParameterizedTest @CsvSource({"H2,H2","PostgreSQL,POSTGRESQL","Oracle,ORACLE","DB2/LINUXX8664,DB2","Microsoft SQL Server,SQLSERVER"})
    void metadataSelectsVendorAndAvailableQuartzDelegate(String product,StandardDatabaseDialect expected) throws Exception {
        assertThat(StandardDatabaseDialect.fromProductName(product)).isSameAs(expected);
        assertThat(Class.forName(expected.quartzDelegateClassName())).isNotNull();
    }

    @Test void unsupportedVendorsDoNotSilentlyUseH2() {
        assertThatThrownBy(()->StandardDatabaseDialect.fromProductName("MySQL"))
                .isInstanceOf(IllegalStateException.class).hasMessage("SC_DATABASE_VENDOR_UNSUPPORTED");
        assertThatThrownBy(()->StandardDatabaseDialect.fromProductName("DB2 DSN12015"))
                .isInstanceOf(IllegalStateException.class);
    }

    @ParameterizedTest @EnumSource(StandardDatabaseDialect.class)
    void orderedPagesKeepFilterBindingsAndStableSecondPage(StandardDatabaseDialect dialect) {
        var jdbc=new JdbcTemplate(source());
        jdbc.execute("CREATE TABLE sample(id INTEGER PRIMARY KEY,category VARCHAR(12))");
        for(int i=1;i<=6;i++)jdbc.update("INSERT INTO sample VALUES(?,?)",i,i==2?"excluded":"kept");
        var rows=jdbc.queryForList(dialect.pageSql("SELECT id FROM sample WHERE category=? ORDER BY id",2,2),Integer.class,"kept");
        assertThat(rows).containsExactly(4,5);
        assertThatThrownBy(()->dialect.pageSql("SELECT id FROM sample ORDER BY id",-1,2)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->dialect.pageSql("SELECT id FROM sample ORDER BY id",0,0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void db2UtcWallClockDoesNotDependOnJvmZone() {
        TimeZone previous=TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
            var jdbc=new JdbcTemplate(source());
            jdbc.execute("CREATE TABLE times(value_at TIMESTAMP(6))");
            Instant instant=Instant.parse("2026-10-09T03:04:05.123456Z");
            Object value=StandardDatabaseDialect.DB2.timestamp(instant);
            assertThat(value).isEqualTo(LocalDateTime.ofInstant(instant,ZoneOffset.UTC));
            jdbc.update("INSERT INTO times VALUES(?)",value);
            Instant restored=jdbc.queryForObject("SELECT value_at FROM times",(row,index)->StandardDatabaseDialect.DB2.readInstant(row,"value_at"));
            assertThat(restored).isEqualTo(instant);
        } finally { TimeZone.setDefault(previous); }
    }

    @Test void automaticBeanUsesMetadataAndConsumerCanReplaceIt() {
        var source=source();
        var runner=new ApplicationContextRunner().withConfiguration(AutoConfigurations.of(ScDatabaseAutoConfiguration.class))
                .withBean(javax.sql.DataSource.class,()->source);
        runner.run(context->assertThat(context.getBean(DatabaseDialect.class)).isSameAs(StandardDatabaseDialect.H2));
        runner.withBean(DatabaseDialect.class,()->StandardDatabaseDialect.POSTGRESQL)
                .run(context->assertThat(context.getBean(DatabaseDialect.class)).isSameAs(StandardDatabaseDialect.POSTGRESQL));
    }

    static JdbcDataSource source() {
        var source=new JdbcDataSource();source.setURL("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1");return source;
    }
}
