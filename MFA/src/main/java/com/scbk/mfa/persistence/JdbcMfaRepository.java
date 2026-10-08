package com.scbk.mfa.persistence;

import com.scbk.mfa.config.MfaConfig;
import com.scbk.mfa.service.MfaRepository;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import javax.sql.DataSource;

/**
 * {@link MfaRepository}의 JDBC 구현.
 *
 * <p>SQL은 운영 DDL 확인 전까지 설정에서 주입받는다. 따라서 설정 SQL의 placeholder 개수와 아래
 * {@code setString} 순서는 반드시 일치해야 한다. 모든 JDBC 자원은 try-with-resources로 요청 단위 반환한다.
 */
public final class JdbcMfaRepository implements MfaRepository {
  private final DataSource dataSource;
  private final MfaConfig.Queries queries;

  public JdbcMfaRepository(DataSource dataSource, MfaConfig.Queries queries) {
    this.dataSource = dataSource;
    this.queries = queries;
  }

  /**
   * {@code query.select-phone}의 첫 번째 placeholder에 행번을 넣고 첫 번째 결과 컬럼을 전화번호로 읽는다.
   */
  @Override
  public String findPhoneNumber(String clerkNumber) throws SQLException {
    try (Connection connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(queries.selectPhone())) {
      statement.setString(1, clerkNumber);
      try (ResultSet result = statement.executeQuery()) {
        return result.next() ? result.getString(1) : "";
      }
    }
  }

  /** sequence 조회 결과의 첫 번째 행·첫 번째 컬럼을 반환한다. */
  @Override
  public String nextSmsSequence() throws SQLException {
    try (Connection connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(queries.selectSequence());
        ResultSet result = statement.executeQuery()) {
      if (!result.next()) {
        throw new SQLException("SMS 시퀀스를 조회하지 못했습니다");
      }
      return result.getString(1);
    }
  }

  /**
   * SMS.MFA 인증정보와 SMS.SMS_REAL 발송정보를 같은 connection, 같은 transaction으로 저장한다.
   *
   * <p>AS-IS는 MFA INSERT를 먼저 commit한 뒤 SMS INSERT가 실패하면 DELETE로 보상했다. 그 사이에 부분
   * 데이터가 노출될 수 있으므로 TO-BE는 두 INSERT가 모두 1건 성공할 때만 commit한다.
   */
  @Override
  public void issue(IssueCommand command) throws SQLException {
    try (Connection connection = dataSource.getConnection()) {
      boolean originalAutoCommit = connection.getAutoCommit();
      connection.setAutoCommit(false);
      try {
        insertAuthCode(connection, command);
        insertSms(connection, command);
        connection.commit();
      } catch (SQLException | RuntimeException e) {
        rollback(connection, e);
        throw e;
      } finally {
        // pool로 돌려보내기 전에 빌려올 당시 상태를 복원한다.
        connection.setAutoCommit(originalAutoCommit);
      }
    }
  }

  private void insertAuthCode(Connection connection, IssueCommand command) throws SQLException {
    try (PreparedStatement statement = connection.prepareStatement(queries.insertAuthCode())) {
      // placeholder 1~8: SEQ, AUTH_CODE, CLERK_NO, PHONE, REQ_CH, REQ_DT, REQ_TM, EXPIRE_DTTM.
      statement.setString(1, command.authenticationSequence());
      statement.setString(2, command.authenticationCode());
      statement.setString(3, command.clerkNumber());
      statement.setString(4, command.phoneNumber());
      statement.setString(5, command.requestChannel());
      statement.setString(6, command.requestDate());
      statement.setString(7, command.requestTime());
      statement.setString(8, command.expirationTimestamp());
      requireSingleRow(statement.executeUpdate(), "MFA 인증정보 저장");
    }
  }

  private void insertSms(Connection connection, IssueCommand command) throws SQLException {
    try (PreparedStatement statement = connection.prepareStatement(queries.insertSms())) {
      // 고정값을 제외한 7개 placeholder 순서는 docs/MFA_변경비교.md의 SMS_REAL 계약과 같다.
      statement.setString(1, command.smsMessageId());
      statement.setString(2, command.nowTimestamp());
      statement.setString(3, command.phoneNumber());
      statement.setString(4, command.nowTimestamp());
      statement.setString(5, command.requestDate());
      statement.setString(6, command.smsMessage());
      statement.setString(7, command.smsEmployeeId());
      requireSingleRow(statement.executeUpdate(), "SMS 발송정보 저장");
    }
  }

  /**
   * 미사용 인증정보의 만료일시를 조회한다.
   *
   * <p>설정 SQL 결과에는 이름이 {@code EXPIRE_DTTM}인 컬럼이 있어야 한다. 실제 이름이 다르면 SQL에서
   * alias를 지정해야 한다.
   */
  @Override
  public Optional<String> findExpiration(String authenticationSequence, String authenticationCode)
      throws SQLException {
    try (Connection connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(queries.selectAuthCode())) {
      statement.setString(1, authenticationSequence);
      statement.setString(2, authenticationCode);
      try (ResultSet result = statement.executeQuery()) {
        return result.next() ? Optional.ofNullable(result.getString("EXPIRE_DTTM")) : Optional.empty();
      }
    }
  }

  /**
   * 미사용이며 아직 만료되지 않은 인증정보 한 건만 사용 처리한다.
   *
   * <p>SELECT 결과만 믿지 않고 UPDATE WHERE 절에서 {@code RES_DT IS NULL}과 만료시각을 다시 검사해야
   * 동시에 같은 인증번호를 검증하는 두 요청 중 하나만 성공한다.
   */
  @Override
  public int consume(
      String authenticationSequence,
      String authenticationCode,
      String responseDate,
      String responseTime,
      String responseTimestamp)
      throws SQLException {
    try (Connection connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(queries.consumeAuthCode())) {
      // 1~3은 갱신값, 4~6은 sequence/code/만료 비교 조건이다.
      statement.setString(1, responseDate);
      statement.setString(2, responseTime);
      statement.setString(3, responseTimestamp);
      statement.setString(4, authenticationSequence);
      statement.setString(5, authenticationCode);
      statement.setString(6, responseTimestamp);
      return statement.executeUpdate();
    }
  }

  /** INSERT 결과가 0건 또는 복수 건이면 transaction을 실패시켜 데이터 불일치를 막는다. */
  private static void requireSingleRow(int affectedRows, String operation) throws SQLException {
    if (affectedRows != 1) {
      throw new SQLException(operation + " 결과가 1건이 아닙니다: " + affectedRows);
    }
  }

  /** rollback 실패를 원래 예외의 suppressed exception으로 보존한다. */
  private static void rollback(Connection connection, Exception original) {
    try {
      connection.rollback();
    } catch (SQLException rollbackError) {
      original.addSuppressed(rollbackError);
    }
  }
}
