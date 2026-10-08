package com.scbk.mfa.protocol;

import java.util.Arrays;
import java.util.List;
import java.nio.charset.Charset;

/**
 * decode된 MFA 요청 전문.
 *
 * <p>필드 accessor는 업무 처리에 적합하도록 양끝 공백을 제거한다. 동시에 AS-IS의 비정상적인 특정 위치 추출
 * 동작을 병행 검증할 수 있도록 원본 byte 복사본과 문자셋을 보관한다.
 */
public final class MfaMessage {
  private final List<String> fields;
  private final byte[] raw;
  private final Charset charset;

  MfaMessage(List<String> fields, byte[] raw, Charset charset) {
    // 호출자가 전달한 mutable 배열을 그대로 보관하지 않아 요청 객체의 불변성을 유지한다.
    this.fields = List.copyOf(fields);
    this.raw = raw == null ? null : Arrays.copyOf(raw, raw.length);
    this.charset = charset;
  }

  public String type() {
    // 메시지 유형은 소문자로 들어와도 AS-IS와 같이 대문자로 정규화한다.
    return field(0).trim().toUpperCase();
  }

  public String responseCode() {
    return field(1).trim();
  }

  public String responseMessage() {
    return field(2).trim();
  }

  public String requestChannel() {
    return field(3).trim();
  }

  public String clerkNumber() {
    return field(4).trim();
  }

  public String authenticationSequence() {
    return field(5).trim();
  }

  public String authenticationCode() {
    return field(6).trim();
  }

  public String field(int index) {
    return fields.get(index);
  }

  public List<String> fields() {
    return fields;
  }

  /**
   * 원본 전문의 byte offset 구간을 설정 문자셋으로 해석한다.
   *
   * <p>새 연계는 고정길이 전문이므로 이 방식을 사용해야 한다. 범위가 잘못되면 예외 대신 빈 값을 반환하여
   * 외부 전문 오류가 서버 worker를 종료시키지 않게 한다.
   */
  public String rawSlice(int offset, int length) {
    if (raw == null || offset < 0 || length < 0 || offset + length > raw.length) {
      return "";
    }
    return new String(raw, offset, length, charset).trim();
  }

  /**
   * 전체 전문을 문자열로 변환한 뒤 Java 문자 index로 자른다.
   *
   * <p>AS-IS의 {@code inData.substring(25, 31)} 동작을 비교·보존하기 위한 호환 전용 메서드다. 다바이트
   * 문자가 앞에 있으면 byte offset과 다른 위치를 가리키므로 신규 필드 처리에는 사용하지 않는다.
   */
  public String legacyCharacterSlice(int beginIndex, int endIndex) {
    if (raw == null) {
      return "";
    }
    String text = new String(raw, charset);
    if (beginIndex < 0 || endIndex < beginIndex || endIndex > text.length()) {
      return "";
    }
    return text.substring(beginIndex, endIndex).trim();
  }
}
