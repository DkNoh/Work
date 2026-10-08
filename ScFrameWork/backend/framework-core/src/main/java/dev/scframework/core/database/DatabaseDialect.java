package dev.scframework.core.database;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;

/**
 * 공통 JDBC 저장소와 소비 앱이 공유하는 DB 차이의 확장점이다. DDL과 업무 SQL은 앱이 소유한다.
 * 기본 구현은 연결 metadata로 H2/PostgreSQL/Oracle/Db2 LUW/SQL Server를 선택하며,
 * 소비 앱은 같은 타입의 Spring bean으로 특수 드라이버나 기존 시간 저장 계약을 교체할 수 있다.
 * 이 계약은 같은 DataSource의 로컬 트랜잭션용이며 여러 DB/EJB 사이의 원자성을 제공하지 않는다.
 */
public interface DatabaseDialect {
    /** 설정/진단용 고정 식별자이며 접속 주소나 계정 정보를 포함하지 않는다. */
    String id();

    /**
     * 호출자가 고정한 ORDER BY SQL에 페이지 범위를 붙인다. 업무 입력은 기존 ? 바인딩에 남긴다.
     * offset/limit는 구현이 검증한 정수만 사용하므로 DB마다 다른 페이지 인수 순서를 호출부에 노출하지 않는다.
     */
    String pageSql(String orderedSql, long offset, int limit);

    /** UTC Instant를 해당 앱 DDL에 맞는 JDBC 4.2 값으로 바꾼다. null은 SQL NULL이다. */
    Object timestamp(Instant value);

    /** 해당 DDL의 시각을 UTC Instant로 복원한다. nullable 완료 시각도 같은 계약을 사용한다. */
    Instant readInstant(ResultSet row, String column) throws SQLException;

    /** Quartz JDBC JobStore에 필요한 공식 delegate 클래스 이름이다. */
    String quartzDelegateClassName();

    /** SQL Server IDENTITY는 일반 INSERT에서 명시 ID를 거절하므로 초기 예약도 DB 생성 키를 사용한다. */
    default boolean permitsExplicitIdentityValues() { return true; }
}
