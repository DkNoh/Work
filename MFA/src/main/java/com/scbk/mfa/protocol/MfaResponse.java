package com.scbk.mfa.protocol;

import java.util.Arrays;
import java.util.List;

/**
 * MFA 응답의 9개 논리 필드 builder.
 *
 * <p>발급은 B, 검증은 D, 프로토콜/과부하 오류는 E 유형을 사용한다. 실제 byte 길이와 문자셋 검증은
 * {@link MfaCodec}이 담당한다.
 */
public final class MfaResponse {
  private final String[] fields = new String[9];

  private MfaResponse(String type, String code, String message) {
    // null 대신 빈 문자열을 사용해 모든 응답이 항상 정확히 9개 필드를 갖게 한다.
    Arrays.fill(fields, "");
    fields[0] = type;
    fields[1] = code;
    fields[2] = message;
  }

  /** 발급(A) 요청에 대한 B 응답을 만들며 성공 시 sequence와 인증번호를 각각 6, 7번 필드에 넣는다. */
  public static MfaResponse issue(String code, String message, String sequence, String authCode) {
    MfaResponse response = new MfaResponse("B", code, message);
    response.fields[5] = sequence == null ? "" : sequence;
    response.fields[6] = authCode == null ? "" : authCode;
    return response;
  }

  /** 검증(C) 요청에 대한 D 응답을 만든다. */
  public static MfaResponse verify(String code, String message) {
    return new MfaResponse("D", code, message);
  }

  /** 잘못된 메시지 유형 또는 프레임에 대한 E/400 응답을 만든다. */
  public static MfaResponse protocolError(String message) {
    return new MfaResponse("E", "400", message);
  }

  /** worker queue 포화 시 DB나 업무 처리를 시작하지 않고 반환할 E/500 응답을 만든다. */
  public static MfaResponse serverBusy() {
    return new MfaResponse("E", "500", "Server Busy");
  }

  /** codec이 순서대로 직렬화할 불변 9개 필드 view를 반환한다. */
  public List<String> fields() {
    return List.of(fields);
  }
}
