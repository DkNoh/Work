package com.scbk.mfa.protocol;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** TCP stream에서 MFA 요청 프레임 한 건을 경계까지 읽는 utility. */
public final class MfaFrameReader {
  private MfaFrameReader() {}

  /**
   * 입력에서 최대 106바이트를 읽고 정확한 길이의 프레임을 반환한다.
   *
   * <p>AS-IS 호출자가 붙이던 CR/LF는 호환을 위해 허용한다. TO-BE는 106바이트가 완성되는 즉시 반환하므로
   * 클라이언트가 LF나 EOF를 보낼 때까지 기다리지 않는다. socket read timeout은 이 메서드 밖에서
   * {@code Socket#setSoTimeout}으로 설정한다.
   *
   * @param input 연결된 client socket의 입력 stream
   * @return CR/LF가 제외된 106바이트 요청
   * @throws IOException socket 또는 stream 읽기 실패
   * @throws MfaProtocolException LF/EOF가 너무 일찍 오거나 프레임이 제한을 초과한 경우
   */
  public static byte[] read(InputStream input) throws IOException, MfaProtocolException {
    ByteArrayOutputStream frame = new ByteArrayOutputStream(MfaCodec.FRAME_LENGTH);
    while (true) {
      int value = input.read();
      if (value < 0 || value == '\n') {
        break;
      }
      if (value == '\r') {
        // Windows식 CRLF의 CR은 프레임 데이터로 계산하지 않는다.
        continue;
      }
      if (frame.size() >= MfaCodec.FRAME_LENGTH) {
        throw new MfaProtocolException("MFA 요청이 106바이트를 초과했습니다");
      }
      frame.write(value);
      if (frame.size() == MfaCodec.FRAME_LENGTH) {
        // 106바이트 뒤 LF 또는 EOF를 기다리지 않아 호출자의 불필요한 대기를 제거한다.
        break;
      }
    }
    if (frame.size() != MfaCodec.FRAME_LENGTH) {
      throw new MfaProtocolException("MFA 요청은 정확히 106바이트여야 합니다");
    }
    return frame.toByteArray();
  }
}
