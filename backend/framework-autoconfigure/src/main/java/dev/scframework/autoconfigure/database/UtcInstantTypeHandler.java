package dev.scframework.autoconfigure.database;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Calendar;
import java.util.TimeZone;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

/**
 * Db2 LUW의 시간대 없는 TIMESTAMP(6)를 UTC Instant로 저장/조회하는 MyBatis 변환기다.
 * 서버/JVM 기본 시간대를 쓰면 JDBC와 JPA가 같은 DB 행을 다른 순간으로 읽을 수 있으므로 Calendar를 명시한다.
 * 입력은 앱 DTO의 Instant, 출력도 Instant이며 HTTP의 ISO-8601 계약은 그대로다. null 처리는 BaseTypeHandler가 맡는다.
 */
public final class UtcInstantTypeHandler extends BaseTypeHandler<Instant> {
    private static Calendar utc() { return Calendar.getInstance(TimeZone.getTimeZone("UTC")); }
    @Override public void setNonNullParameter(PreparedStatement statement,int index,Instant value,JdbcType type)throws SQLException {
        statement.setTimestamp(index,Timestamp.from(value),utc());
    }
    @Override public Instant getNullableResult(ResultSet row,String column)throws SQLException {
        return instant(row.getTimestamp(column,utc()));
    }
    @Override public Instant getNullableResult(ResultSet row,int column)throws SQLException {
        return instant(row.getTimestamp(column,utc()));
    }
    @Override public Instant getNullableResult(CallableStatement statement,int column)throws SQLException {
        return instant(statement.getTimestamp(column,utc()));
    }
    private static Instant instant(Timestamp value) { return value==null?null:value.toInstant(); }
}
