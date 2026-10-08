package com.scbk.mfa.service;

import com.scbk.mfa.protocol.MfaMessage;
import com.scbk.mfa.protocol.MfaResponse;
import java.security.SecureRandom;
import java.sql.SQLException;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * MFA 발급(A)과 검증(C)의 업무 규칙을 수행하는 application service.
 *
 * <p>TCP, JDBC 구현과 분리되어 있으며 고정된 {@link Clock}, 인증번호 supplier, fake repository를 주입할 수
 * 있어 시간 경계와 DB 결과를 단위 테스트한다. 외부에는 내부 예외 상세를 노출하지 않고 기존 응답 코드 계약으로
 * 변환한다.
 */
public final class MfaService {
  /** AS-IS DB에 저장하는 날짜/시간 조합 형식. */
  private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

  /** 전문의 행번 필드는 6바이트이며 AS-IS와 동일하게 숫자만 허용한다. */
  private static final Pattern CLERK_NUMBER = Pattern.compile("^\\d{1,6}$");

  /** 하이픈 제거 후 허용하는 국내 휴대전화 번호 형식. */
  private static final Pattern PHONE_NUMBER = Pattern.compile("^01(?:0|1|[6-9])(?:\\d{3}|\\d{4})\\d{4}$");

  private final MfaRepository repository;
  private final Clock clock;
  private final long authTtlMinutes;
  private final Supplier<String> authCodeSupplier;

  /** 운영용 생성자. 암호학적 난수로 6자리 인증번호를 만든다. */
  public MfaService(MfaRepository repository, Clock clock, long authTtlMinutes) {
    this(repository, clock, authTtlMinutes, new SecureAuthCodeSupplier());
  }

  /** 테스트에서 인증번호를 고정할 수 있는 package-private 생성자. */
  MfaService(
      MfaRepository repository,
      Clock clock,
      long authTtlMinutes,
      Supplier<String> authCodeSupplier) {
    this.repository = repository;
    this.clock = clock;
    this.authTtlMinutes = authTtlMinutes;
    this.authCodeSupplier = authCodeSupplier;
  }

  /** 요청 유형 A/C를 해당 업무로 분기하고 알 수 없는 유형은 E/400으로 거부한다. */
  public MfaResponse handle(MfaMessage request) {
    return switch (request.type()) {
      case "A" -> issue(request);
      case "C" -> verify(request);
      default -> MfaResponse.protocolError("Request Message Error[MESSAGE ERROR]");
    };
  }

  /**
   * 행번의 전화번호를 조회하여 인증번호와 SMS queue를 함께 생성한다.
   *
   * <p>업무 순서: 필수값 검증 → 전화번호 조회/검증 → DB sequence와 인증번호 생성 → MFA/SMS 단일
   * transaction 저장 → B 응답. DB 예외 시 인증정보를 응답에 싣지 않는다.
   */
  private MfaResponse issue(MfaMessage request) {
    if (request.requestChannel().isBlank()) {
      return MfaResponse.issue("400", "Request Message Error[REQ_CH IS NULL]", "", "");
    }
    if (request.clerkNumber().isBlank()) {
      return MfaResponse.issue("400", "Request Message Error[CLERK_NO IS NULL]", "", "");
    }
    if (!CLERK_NUMBER.matcher(request.clerkNumber()).matches()) {
      return MfaResponse.issue("404", "Data Type Error[CLERK_NO ERROR]", "", "");
    }

    try {
      String phone = digits(repository.findPhoneNumber(request.clerkNumber()));
      if (!PHONE_NUMBER.matcher(phone).matches()) {
        return MfaResponse.issue("404", "Data Type Error[PHONE NUMBER]", "", "");
      }

      LocalDateTime now = LocalDateTime.now(clock);
      String nowText = TIMESTAMP.format(now);
      String authCode = authCodeSupplier.get();
      String requestChannel = request.requestChannel();
      // AS-IS 계약: 요청 채널 앞 최대 4자 + 초 단위 시각. 같은 채널/같은 초 충돌 위험은 전환 문서 참조.
      String authSequence =
          requestChannel.substring(0, Math.min(4, requestChannel.length())) + nowText;
      String smsMessageId = repository.nextSmsSequence() + nowText;
      // AS-IS의 inData.substring(25, 31)을 보존한 값이다. 실제 EMP_ID가 행번인지 반드시 업무 확인한다.
      String smsEmployeeId = request.legacyCharacterSlice(25, 31);
      String smsMessage =
          "[SC제일은행]\n[" + requestChannel + "] 인증번호는 [" + authCode + "] 입니다.";

      repository.issue(
          new MfaRepository.IssueCommand(
              authSequence,
              authCode,
              request.clerkNumber(),
              phone,
              requestChannel,
              nowText.substring(0, 8),
              nowText.substring(8, 14),
              TIMESTAMP.format(now.plusMinutes(authTtlMinutes)),
              smsMessageId,
              smsEmployeeId,
              smsMessage,
              nowText));
      return MfaResponse.issue("200", "Success", authSequence, authCode);
    } catch (SQLException | RuntimeException e) {
      // 인증번호, SQL, 계정 정보 등의 내부 상세를 TCP 응답에 노출하지 않는다.
      return MfaResponse.issue("500", "DB Error", "", "");
    }
  }

  /**
   * sequence와 인증번호를 확인하고 조건부 UPDATE로 한 번만 사용 처리한다.
   *
   * <p>사전 SELECT는 사용자에게 만료/불일치 결과를 주기 위한 조회다. 최종 성공 여부는 동시 요청을 고려해
   * {@code consume()}의 영향 행 수가 정확히 1인지로 판단한다.
   */
  private MfaResponse verify(MfaMessage request) {
    if (request.authenticationSequence().isBlank()) {
      return MfaResponse.verify("400", "Request Message Error[SEQ IS NULL]");
    }
    if (request.authenticationCode().isBlank()) {
      return MfaResponse.verify("400", "Request Message Error[AUTH CODE NULL]");
    }

    try {
      Optional<String> expiration =
          repository.findExpiration(
              request.authenticationSequence(), request.authenticationCode());
      if (expiration.isEmpty()) {
        return MfaResponse.verify("401", "Authentication Fail[INFO ERROR]");
      }

      LocalDateTime now = LocalDateTime.now(clock);
      LocalDateTime expiresAt = LocalDateTime.parse(expiration.orElseThrow(), TIMESTAMP);
      // 만료시각과 정확히 같은 순간은 유효하며, 현재시각이 이후일 때만 만료로 처리한다.
      if (now.isAfter(expiresAt)) {
        return MfaResponse.verify("401", "Authentication Fail[TIME OVER]");
      }

      String nowText = TIMESTAMP.format(now);
      int updated =
          repository.consume(
              request.authenticationSequence(),
              request.authenticationCode(),
              nowText.substring(0, 8),
              nowText.substring(8, 14),
              nowText);
      if (updated != 1) {
        return MfaResponse.verify("401", "Authentication Fail[INFO ERROR]");
      }
      return MfaResponse.verify("200", "Success");
    } catch (SQLException | RuntimeException e) {
      return MfaResponse.verify("500", "DB Error");
    }
  }

  /** 저장된 전화번호에서 하이픈, 공백 등 숫자가 아닌 문자를 제거한다. */
  private static String digits(String value) {
    if (value == null) {
      return "";
    }
    return value.replaceAll("\\D", "");
  }

  /** 예측하기 어려운 000000~999999 범위의 6자리 인증번호 supplier. */
  private static final class SecureAuthCodeSupplier implements Supplier<String> {
    private final SecureRandom random = new SecureRandom();

    @Override
    public String get() {
      // %06d로 선행 0을 보존한다. java.util.Random은 보안 코드 생성에 사용하지 않는다.
      return String.format("%06d", random.nextInt(1_000_000));
    }
  }

  /** 운영 시간 계산을 서버 기본 timezone이 아니라 명시적인 서울 시간으로 고정한다. */
  public static Clock seoulClock() {
    return Clock.system(ZoneId.of("Asia/Seoul"));
  }
}
