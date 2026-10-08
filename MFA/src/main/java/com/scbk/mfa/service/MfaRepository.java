package com.scbk.mfa.service;

import java.sql.SQLException;
import java.util.Optional;

/**
 * MFA 업무 서비스와 영속성 구현 사이의 계약.
 *
 * <p>서비스가 Oracle/HikariCP 세부 구현을 알지 않게 하며 단위 테스트에서는 in-memory fake로 대체한다. SQL
 * 예외는 숨기지 않고 서비스까지 전달하여 외부 응답을 500으로 일관되게 변환한다.
 */
public interface MfaRepository {
  /** 행번으로 SMS 수신 전화번호를 조회하며 없으면 빈 문자열을 반환한다. */
  String findPhoneNumber(String clerkNumber) throws SQLException;

  /** SMS_REAL의 CMP_MSG_ID를 만들 때 사용할 DB sequence 다음 값을 조회한다. */
  String nextSmsSequence() throws SQLException;

  /** 인증정보와 SMS queue 데이터를 하나의 DB transaction으로 저장한다. */
  void issue(IssueCommand command) throws SQLException;

  /** 아직 사용되지 않은 sequence/인증번호의 만료일시를 조회한다. */
  Optional<String> findExpiration(String authenticationSequence, String authenticationCode)
      throws SQLException;

  /**
   * 인증번호를 조건부로 일회성 사용 처리한다.
   *
   * @return 실제 UPDATE된 행 수. 정확히 1일 때만 검증 성공으로 인정한다.
   */
  int consume(
      String authenticationSequence,
      String authenticationCode,
      String responseDate,
      String responseTime,
      String responseTimestamp)
      throws SQLException;

  /**
   * 발급 transaction에 필요한 값을 한 번에 전달하는 불변 command.
   *
   * <p>날짜 문자열 형식은 AS-IS DB 계약에 맞춘 {@code yyyyMMdd}, {@code HHmmss},
   * {@code yyyyMMddHHmmss}다. 실제 컬럼이 DATE/TIMESTAMP라면 Repository 바인딩과 SQL을 함께 변경해야 한다.
   */
  record IssueCommand(
      String authenticationSequence,
      String authenticationCode,
      String clerkNumber,
      String phoneNumber,
      String requestChannel,
      String requestDate,
      String requestTime,
      String expirationTimestamp,
      String smsMessageId,
      String smsEmployeeId,
      String smsMessage,
      String nowTimestamp) {}
}
