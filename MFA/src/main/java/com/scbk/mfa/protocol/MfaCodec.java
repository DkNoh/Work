package com.scbk.mfa.protocol;

import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * AS-IS MFA 고정길이 전문과 Java 객체 사이의 byte codec.
 *
 * <p>전문은 9개 필드, 총 106바이트다. 한글은 문자 수와 바이트 수가 다르므로 모든 offset과 길이를 설정
 * 문자셋으로 인코딩한 byte 기준으로 계산한다. 필드가 정해진 크기를 넘을 때 잘라내지 않고 오류로 처리하여 뒤
 * 필드의 offset이 밀리는 것을 방지한다.
 */
public final class MfaCodec {
  /** 요청과 응답 한 건의 LF/CR을 제외한 고정 byte 길이. */
  public static final int FRAME_LENGTH = 106;

  /**
   * 필드별 byte 길이: 유형, 응답코드, 응답메시지, 요청채널, 행번, 인증 sequence, 인증번호, 예약1, 예약2.
   */
  public static final int[] FIELD_LENGTHS = {1, 3, 40, 10, 6, 20, 6, 10, 10};

  private final Charset charset;

  public MfaCodec(Charset charset) {
    this.charset = charset;
  }

  public Charset charset() {
    return charset;
  }

  /**
   * 정확히 106바이트인 프레임을 필드별로 분리한다.
   *
   * <p>여기서는 공백을 제거하지 않는다. 원본 필드값과 legacy offset 접근을 보존하고, 의미값이 필요한
   * {@link MfaMessage} accessor에서 trim한다.
   *
   * @throws MfaProtocolException 프레임 길이가 106바이트가 아닌 경우
   */
  public MfaMessage decode(byte[] frame) throws MfaProtocolException {
    if (frame == null || frame.length != FRAME_LENGTH) {
      throw new MfaProtocolException("MFA 전문은 정확히 106바이트여야 합니다");
    }
    List<String> fields = new ArrayList<>(FIELD_LENGTHS.length);
    int offset = 0;
    for (int fieldLength : FIELD_LENGTHS) {
      fields.add(new String(frame, offset, fieldLength, charset));
      offset += fieldLength;
    }
    return new MfaMessage(fields, frame, charset);
  }

  /**
   * 응답 9개 필드를 고정길이 106바이트 프레임으로 직렬화한다.
   *
   * <p>각 필드는 오른쪽을 ASCII space로 채운다. 다바이트 문자를 포함해도 필드 경계를 유지하도록 인코딩 후
   * 길이를 검사한다.
   *
   * @throws MfaProtocolException 필드 수가 다르거나 필드가 할당된 byte 길이를 넘는 경우
   */
  public byte[] encode(MfaResponse response) throws MfaProtocolException {
    ByteArrayOutputStream output = new ByteArrayOutputStream(FRAME_LENGTH);
    List<String> fields = response.fields();
    if (fields.size() != FIELD_LENGTHS.length) {
      throw new MfaProtocolException("MFA 응답 필드 수가 올바르지 않습니다");
    }
    for (int i = 0; i < FIELD_LENGTHS.length; i++) {
      byte[] value = fields.get(i).getBytes(charset);
      int fieldLength = FIELD_LENGTHS[i];
      if (value.length > fieldLength) {
        throw new MfaProtocolException("MFA 응답 필드 " + i + "가 " + fieldLength + "바이트를 초과했습니다");
      }
      output.writeBytes(value);
      // 기존 전문 계약은 NUL이 아니라 ASCII space 오른쪽 padding을 사용한다.
      byte[] padding = new byte[fieldLength - value.length];
      Arrays.fill(padding, (byte) ' ');
      output.writeBytes(padding);
    }
    return output.toByteArray();
  }
}
