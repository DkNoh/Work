package com.scbk.mfa.persistence;

import static org.junit.jupiter.api.Assertions.*;

import com.scbk.mfa.config.MfaConfig;
import com.scbk.mfa.service.MfaRepository.IssueCommand;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** 실제 Hikari/JDBC를 H2에 연결한다. 운영 DDL/Oracle 방언 호환성을 입증하는 테스트는 아니다. */
class JdbcMfaRepositoryTest {
  private HikariDataSource pool;
  private JdbcMfaRepository repository;

  @BeforeEach
  void createIsolatedDatabase() throws Exception {
    pool = MfaDataSourceFactory.create(new MfaConfig.Database(
        "jdbc:h2:mem:mfa_" + UUID.randomUUID(), "sa", "", "org.h2.Driver", 2, 1, 500, 250));
    try (Connection c = pool.getConnection(); var s = c.createStatement()) {
      s.execute("CREATE TABLE employee (id VARCHAR(6) PRIMARY KEY, phone VARCHAR(20))");
      s.execute("INSERT INTO employee VALUES ('000123', '01000000000')");
      s.execute("CREATE SEQUENCE sms_seq START WITH 1");
      s.execute("CREATE TABLE auth (seq VARCHAR(20) PRIMARY KEY, code VARCHAR(6), clerk VARCHAR(6),"
          + " phone VARCHAR(20), channel VARCHAR(10), req_dt VARCHAR(8), req_tm VARCHAR(6),"
          + " expire_dttm VARCHAR(14), res_dt VARCHAR(8), res_tm VARCHAR(6), res_dttm VARCHAR(14))");
      s.execute("CREATE TABLE sms_queue (id VARCHAR(30) PRIMARY KEY, created VARCHAR(14),"
          + " phone VARCHAR(20), send_time VARCHAR(14), send_date VARCHAR(8), body VARCHAR(200), employee VARCHAR(6))");
    }
    repository = new JdbcMfaRepository(pool, new MfaConfig.Queries(
        "SELECT phone FROM employee WHERE id = ?",
        "SELECT NEXT VALUE FOR sms_seq",
        "INSERT INTO auth(seq,code,clerk,phone,channel,req_dt,req_tm,expire_dttm) VALUES(?,?,?,?,?,?,?,?)",
        "INSERT INTO sms_queue VALUES(?,?,?,?,?,?,?)",
        "SELECT expire_dttm FROM auth WHERE seq=? AND code=? AND res_dt IS NULL",
        "UPDATE auth SET res_dt=?,res_tm=?,res_dttm=? WHERE seq=? AND code=? AND res_dt IS NULL AND expire_dttm>=?"));
  }

  @AfterEach
  void closePool() { if (pool != null) pool.close(); }

  @Test
  void looksUpPhoneAndSequence() throws Exception {
    assertEquals("01000000000", repository.findPhoneNumber("000123"));
    assertEquals("", repository.findPhoneNumber("999999"));
    assertEquals("1", repository.nextSmsSequence());
    assertEquals("2", repository.nextSmsSequence());
  }

  @Test
  void commitsAuthAndSmsTogetherAndReturnsConnection() throws Exception {
    repository.issue(command("SEQ-1", "MSG-1"));
    assertEquals(1, count("auth"));
    assertEquals(1, count("sms_queue"));
    assertEquals("20261007120500", repository.findExpiration("SEQ-1", "000007").orElseThrow());
    assertEquals(0, pool.getHikariPoolMXBean().getActiveConnections());
    try (Connection c = pool.getConnection()) { assertTrue(c.getAutoCommit()); }
  }

  @Test
  void rollsBackAuthWhenSmsInsertFailsAndPoolRemainsUsable() throws Exception {
    repository.issue(command("SEQ-1", "MSG-1"));
    // 두 번째 SMS PK 충돌: 그 전에 INSERT한 SEQ-2도 rollback되어야 한다.
    assertThrows(SQLException.class, () -> repository.issue(command("SEQ-2", "MSG-1")));
    assertEquals(1, count("auth"));
    assertEquals(1, count("sms_queue"));
    assertTrue(repository.findExpiration("SEQ-2", "000007").isEmpty());
    try (Connection c = pool.getConnection()) { assertTrue(c.getAutoCommit()); }
    repository.issue(command("SEQ-3", "MSG-3"));
    assertEquals(2, count("auth"));
    assertEquals(0, pool.getHikariPoolMXBean().getActiveConnections());
  }

  @Test
  void simultaneousVerificationConsumesExactlyOnce() throws Exception {
    repository.issue(command("SEQ-1", "MSG-1"));
    CyclicBarrier ready = new CyclicBarrier(2);
    try (var executor = Executors.newFixedThreadPool(2)) {
      java.util.concurrent.Callable<Integer> attempt = () -> {
        ready.await(3, TimeUnit.SECONDS);
        return consume("20261007120500");
      };
      var first = executor.submit(attempt);
      var second = executor.submit(attempt);
      assertEquals(1, first.get(5, TimeUnit.SECONDS) + second.get(5, TimeUnit.SECONDS));
    }
    assertTrue(repository.findExpiration("SEQ-1", "000007").isEmpty());
  }

  @Test
  void expiredOrWrongCodeCannotBeConsumed() throws Exception {
    repository.issue(command("SEQ-1", "MSG-1"));
    assertEquals(0, consume("20261007120501"));
    assertTrue(repository.findExpiration("SEQ-1", "999999").isEmpty());
    assertEquals(0, repository.consume("SEQ-1", "999999", "20261007", "120000", "20261007120000"));
  }

  @Test
  void poolExhaustionTimesOutThenRecoversAfterReturn() throws Exception {
    try (Connection first = pool.getConnection(); Connection second = pool.getConnection()) {
      assertFalse(first.isClosed());
      assertFalse(second.isClosed());
      assertThrows(SQLException.class, () -> { try (Connection ignored = pool.getConnection()) {} });
    }
    try (Connection recovered = pool.getConnection()) { assertTrue(recovered.isValid(1)); }
  }

  @Test
  void closedPoolRejectsNewBorrow() {
    pool.close();
    assertTrue(pool.isClosed());
    assertThrows(SQLException.class, () -> pool.getConnection());
  }

  private int consume(String now) throws SQLException {
    return repository.consume("SEQ-1", "000007", "20261007", "120500", now);
  }

  private int count(String table) throws SQLException {
    // table 값은 이 테스트 안의 상수만 사용한다.
    try (Connection c = pool.getConnection(); var s = c.createStatement();
        var rows = s.executeQuery("SELECT COUNT(*) FROM " + table)) {
      rows.next(); return rows.getInt(1);
    }
  }

  private IssueCommand command(String seq, String smsId) {
    return new IssueCommand(seq, "000007", "000123", "01000000000", "SMS", "20261007", "120000",
        "20261007120500", smsId, "000123", "synthetic test message", "20261007120000");
  }
}
