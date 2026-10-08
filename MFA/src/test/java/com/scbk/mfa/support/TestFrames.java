package com.scbk.mfa.support;

import java.nio.charset.Charset;
import java.util.Arrays;

/** 테스트 요청을 실제 codec과 독립적으로 구성해 잘못된 offset을 서로 상쇄하지 않게 한다. */
public final class TestFrames {
  private TestFrames() {}

  public static byte[] request(String type, String channel, String id, String sequence, String code) {
    byte[] frame = new byte[106];
    Arrays.fill(frame, (byte) ' ');
    put(frame, 0, 1, type);
    put(frame, 44, 10, channel);
    put(frame, 54, 6, id);
    put(frame, 60, 20, sequence);
    put(frame, 80, 6, code);
    return frame;
  }

  private static void put(byte[] frame, int offset, int width, String value) {
    byte[] bytes = value.getBytes(Charset.forName("EUC-KR"));
    if (bytes.length > width) {
      throw new IllegalArgumentException("테스트 필드 길이 초과");
    }
    System.arraycopy(bytes, 0, frame, offset, bytes.length);
  }
}
