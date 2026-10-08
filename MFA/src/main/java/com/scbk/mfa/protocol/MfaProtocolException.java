package com.scbk.mfa.protocol;

/**
 * 길이, 필드 크기 또는 프레임 경계가 MFA 고정길이 계약과 맞지 않을 때 발생하는 checked exception.
 *
 * <p>업무 오류나 DB 오류와 구분하여 TCP 계층이 민감정보 없이 E/400 프로토콜 오류로 응답할 수 있게 한다.
 */
public class MfaProtocolException extends Exception {
  public MfaProtocolException(String message) {
    super(message);
  }
}
