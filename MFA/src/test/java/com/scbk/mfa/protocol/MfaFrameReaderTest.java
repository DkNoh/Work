package com.scbk.mfa.protocol;

import static org.junit.jupiter.api.Assertions.*;
import static com.scbk.mfa.support.TestFrames.request;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class MfaFrameReaderTest {
  @Test
  void returnsWithoutWaitingForEofOrNewline() throws Exception {
    byte[] frame = request("A", "SMS", "000123", "", "");
    InputStream input = new InputStream() {
      private int offset;
      public int read() {
        if (offset == frame.length) {
          fail("106바이트 이후 EOF를 기다리면 안 됨");
        }
        return frame[offset++] & 0xff;
      }
    };
    assertArrayEquals(frame, MfaFrameReader.read(input));
  }

  @Test
  void acceptsTrailingCrLf() throws Exception {
    byte[] frame = request("C", "SMS", "000123", "SEQ", "000007");
    ByteArrayOutputStream stream = new ByteArrayOutputStream();
    stream.writeBytes(frame);
    stream.writeBytes(new byte[] {'\r', '\n'});
    assertArrayEquals(frame, MfaFrameReader.read(new ByteArrayInputStream(stream.toByteArray())));
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "A", "A\n", "A\r\n"})
  void rejectsEarlyEofOrNewline(String text) {
    assertThrows(MfaProtocolException.class,
        () -> MfaFrameReader.read(new ByteArrayInputStream(text.getBytes(java.nio.charset.StandardCharsets.US_ASCII))));
  }
}
