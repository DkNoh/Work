package dev.scframework.autoconfigure.database;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Savepoint;
import javax.sql.DataSource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 동일 트랜잭션 안에서 유일 키 중복만 무시하는 INSERT 경계다. receipt/집계/예약 실행 중복에 사용한다.
 * PostgreSQL은 실패한 statement 뒤 TX가 aborted가 되므로 catch만 해서는 다음 SELECT/UPDATE를 실행할 수 없다.
 * INSERT 직전 JDBC savepoint로 돌아가 앞선 업무 DML은 보존하고, 그 외 오류는 전체 TX로 전파한다.
 * JDBC가 참여하는 로컬 DataSource TX를 요구한다. JTA/XA 자원은 별도 이관 어댑터가 필요하다.
 */
public final class JdbcDuplicateInsert {
    private final DataSource source;
    public JdbcDuplicateInsert(DataSource source) { this.source = source; }

    /** true는 삽입, false는 이미 존재함이다. 중복 외 제약/연결/저장 오류를 정상으로 삼키지 않는다. */
    public boolean insert(Runnable statement) {
        if (!TransactionSynchronizationManager.isActualTransactionActive())
            throw new IllegalStateException("SC_DATABASE_LOCAL_TX_REQUIRED");
        Connection connection = DataSourceUtils.getConnection(source);
        Savepoint savepoint = null;
        try {
            if (connection.getAutoCommit() || !DataSourceUtils.isConnectionTransactional(connection, source))
                throw new IllegalStateException("SC_DATABASE_LOCAL_TX_REQUIRED");
            savepoint = connection.setSavepoint();
            try {
                statement.run();
                return true;
            } catch (DuplicateKeyException duplicate) {
                connection.rollback(savepoint);
                return false;
            }
        } catch (SQLException failure) {
            throw new IllegalStateException("SC_DATABASE_SAVEPOINT_FAILED", failure);
        } finally {
            if (savepoint != null) {
                // Oracle/SQL Server 드라이버는 releaseSavepoint를 제공하지 않는다. 해당 자원은 TX 종료 시 정리된다.
                try {
                    String product = connection.getMetaData().getDatabaseProductName();
                    if (!"Oracle".equals(product) && !"Microsoft SQL Server".equals(product)) connection.releaseSavepoint(savepoint);
                } catch (SQLException ignored) { /* release 실패는 커밋/rollback 책임을 바꾸지 않는다. */ }
            }
            DataSourceUtils.releaseConnection(connection, source);
        }
    }
}
