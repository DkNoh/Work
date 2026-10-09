package dev.scframework.autoconfigure.database;

import dev.scframework.core.database.DatabaseDialect;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import javax.sql.DataSource;

/**
 * 실제 JDBC 제품명을 공통 SQL/시간/Quartz 계약에 연결하는 기본 구현이다.
 * H2 compatibility mode를 외부 DB 실행으로 간주하지 않으며 알 수 없는 제품을 H2로 추정하지 않는다.
 * Db2는 LUW의 TIMESTAMP(6)에 UTC 벽시각을 저장한다. 다른 DB의 앱 DDL은 시간대 포함 타입을 사용한다.
 */
public enum StandardDatabaseDialect implements DatabaseDialect {
    H2("h2", "StdJDBCDelegate"),
    POSTGRESQL("postgresql", "PostgreSQLDelegate"),
    ORACLE("oracle", "oracle.OracleDelegate"),
    DB2("db2", "DB2v8Delegate"),
    SQLSERVER("sqlserver", "MSSQLDelegate");

    private final String id;
    private final String delegate;

    StandardDatabaseDialect(String id, String delegate) { this.id = id; this.delegate = delegate; }
    @Override public String id() { return id; }

    @Override public String pageSql(String orderedSql, long offset, int limit) {
        if (orderedSql == null || orderedSql.isBlank() || offset < 0 || limit < 1)
            throw new IllegalArgumentException("SC_DATABASE_PAGE_INVALID");
        return this == H2 || this == POSTGRESQL
                ? orderedSql + " LIMIT " + limit + " OFFSET " + offset
                : orderedSql + " OFFSET " + offset + " ROWS FETCH NEXT " + limit + " ROWS ONLY";
    }

    @Override public Object timestamp(Instant value) {
        if (value == null) return null;
        return this == DB2 ? LocalDateTime.ofInstant(value, ZoneOffset.UTC) : value.atOffset(ZoneOffset.UTC);
    }

    @Override public Instant readInstant(ResultSet row, String column) throws SQLException {
        if (this == DB2) {
            // Calendar를 명시하여 개발 PC/서버 기본 시간대가 달라도 UTC TIMESTAMP의 의미를 유지한다.
            var value = row.getTimestamp(column, Calendar.getInstance(TimeZone.getTimeZone("UTC")));
            return value == null ? null : value.toInstant();
        }
        OffsetDateTime value = row.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    @Override public String quartzDelegateClassName() { return "org.quartz.impl.jdbcjobstore." + delegate; }
    @Override public boolean permitsExplicitIdentityValues() { return this != SQLSERVER; }

    /** URL/계정 정보를 오류에 포함하지 않고 metadata 연결 실패와 미지원 제품을 명시적으로 거절한다. */
    public static StandardDatabaseDialect detect(DataSource source) {
        try (var connection = source.getConnection()) {
            return fromProductName(connection.getMetaData().getDatabaseProductName());
        } catch (SQLException failure) {
            throw new IllegalStateException("SC_DATABASE_METADATA_UNAVAILABLE");
        }
    }

    public static StandardDatabaseDialect fromProductName(String product) {
        String name = product == null ? "" : product.toLowerCase(Locale.ROOT);
        if (name.equals("h2")) return H2;
        if (name.equals("postgresql")) return POSTGRESQL;
        if (name.equals("oracle")) return ORACLE;
        if (name.startsWith("db2/")) return DB2;
        if (name.equals("microsoft sql server")) return SQLSERVER;
        throw new IllegalStateException("SC_DATABASE_VENDOR_UNSUPPORTED");
    }
}
