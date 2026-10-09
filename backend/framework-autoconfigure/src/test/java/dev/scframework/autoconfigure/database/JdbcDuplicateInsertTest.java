package dev.scframework.autoconfigure.database;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.AbstractDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;

/** SQL 오류 이후 aborted 상태를 강제하는 연결로 중복 후 조회/갱신이 반드시 savepoint 복구를 거치는지 검사한다. */
class JdbcDuplicateInsertTest {
    @Test void duplicateRestoresTransactionAndOuterRollbackStillOwnsAllWrites() {
        DataSource source=strictSource();var jdbc=new JdbcTemplate(source);
        jdbc.execute("CREATE TABLE work_item(id INTEGER PRIMARY KEY,value_text VARCHAR(10) NOT NULL)");
        jdbc.update("INSERT INTO work_item VALUES(1,'original')");
        var duplicate=new JdbcDuplicateInsert(source);
        var tx=new TransactionTemplate(new DataSourceTransactionManager(source));
        tx.executeWithoutResult(status->{
            jdbc.update("INSERT INTO work_item VALUES(2,'before')");
            assertThat(duplicate.insert(()->jdbc.update("INSERT INTO work_item VALUES(1,'duplicate')"))).isFalse();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM work_item",Integer.class)).isEqualTo(2);
            assertThat(duplicate.insert(()->jdbc.update("INSERT INTO work_item VALUES(3,'after')"))).isTrue();
            status.setRollbackOnly();
        });
        assertThat(jdbc.queryForList("SELECT id FROM work_item ORDER BY id",Integer.class)).containsExactly(1);
        tx.executeWithoutResult(status->{
            assertThat(duplicate.insert(()->jdbc.update("INSERT INTO work_item VALUES(1,'duplicate')"))).isFalse();
            jdbc.update("INSERT INTO work_item VALUES(4,'commit')");
        });
        assertThat(jdbc.queryForList("SELECT id FROM work_item ORDER BY id",Integer.class)).containsExactly(1,4);
    }

    @Test void nonDuplicateConstraintFailureIsNotAcceptedAndMissingTransactionIsRejected() {
        DataSource source=DatabasePortabilityTest.source();var jdbc=new JdbcTemplate(source);
        jdbc.execute("CREATE TABLE work_item(id INTEGER PRIMARY KEY,value_text VARCHAR(10) NOT NULL)");
        var duplicate=new JdbcDuplicateInsert(source);var tx=new TransactionTemplate(new DataSourceTransactionManager(source));
        assertThatThrownBy(()->duplicate.insert(()->jdbc.update("INSERT INTO work_item VALUES(1,'value')")))
                .isInstanceOf(IllegalStateException.class).hasMessage("SC_DATABASE_LOCAL_TX_REQUIRED");
        assertThatThrownBy(()->tx.executeWithoutResult(status->{
            jdbc.update("INSERT INTO work_item VALUES(1,'before')");
            duplicate.insert(()->jdbc.update("INSERT INTO work_item VALUES(2,NULL)"));
        })).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM work_item",Integer.class)).isZero();
    }

    private static DataSource strictSource() {
        var delegate=DatabasePortabilityTest.source();
        return new AbstractDataSource(){
            @Override public Connection getConnection()throws SQLException{return strict(delegate.getConnection());}
            @Override public Connection getConnection(String user,String password)throws SQLException{return getConnection();}
        };
    }

    private static Connection strict(Connection connection) {
        AtomicBoolean aborted=new AtomicBoolean();
        return (Connection)Proxy.newProxyInstance(Connection.class.getClassLoader(),new Class<?>[]{Connection.class},(proxy,method,args)->{
            try {
                if(method.getName().equals("rollback"))aborted.set(false);
                Object result=method.invoke(connection,args);
                if(result instanceof PreparedStatement statement){
                    return Proxy.newProxyInstance(PreparedStatement.class.getClassLoader(),new Class<?>[]{PreparedStatement.class},(p,m,a)->{
                        if(m.getName().startsWith("execute")&&aborted.get())throw new SQLException("fixture aborted transaction","25P02");
                        try{return m.invoke(statement,a);}
                        catch(InvocationTargetException failure){
                            if(failure.getCause() instanceof SQLException)aborted.set(true);
                            throw failure.getCause();
                        }
                    });
                }
                return result;
            }catch(InvocationTargetException failure){throw failure.getCause();}
        });
    }
}
