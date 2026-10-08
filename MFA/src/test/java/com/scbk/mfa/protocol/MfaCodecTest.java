package com.scbk.mfa.protocol;

import static org.junit.jupiter.api.Assertions.*;
import static com.scbk.mfa.support.TestFrames.request;

import java.nio.charset.Charset;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class MfaCodecTest {
  private final Charset charset = Charset.forName("EUC-KR");
  private final MfaCodec codec = new MfaCodec(charset);

  @Test
  void decodesFixedOffsetsAndNormalizesType() throws Exception {
    MfaMessage result = codec.decode(request("a", "SMS", "000123", "SEQ-1", "000007"));
    assertAll(() -> assertEquals("A", result.type()),
        () -> assertEquals("SMS", result.requestChannel()),
        () -> assertEquals("000123", result.clerkNumber()),
        () -> assertEquals("SEQ-1", result.authenticationSequence()),
        () -> assertEquals("000007", result.authenticationCode()));
  }

  @Test
  void koreanResponsePreservesByteOffsetsAndSpacePadding() throws Exception {
    byte[] frame = codec.encode(MfaResponse.issue("200", "인증 성공", "SEQ-1", "000007"));
    assertEquals(106, frame.length);
    assertEquals("B200", new String(frame, 0, 4, charset));
    assertEquals("인증 성공", new String(frame, 4, 40, charset).trim());
    assertEquals("SEQ-1", new String(frame, 60, 20, charset).trim());
    assertEquals("000007", new String(frame, 80, 6, charset));
    for (byte value : Arrays.copyOfRange(frame, 86, 106)) {
      assertEquals((byte) ' ', value);
    }
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 105, 107})
  void rejectsWrongFrameLength(int length) {
    assertThrows(MfaProtocolException.class, () -> codec.decode(new byte[length]));
  }

  @Test
  void rejectsNullFrame() {
    assertThrows(MfaProtocolException.class, () -> codec.decode(null));
  }

  @Test
  void rejectsMultibyteFieldOverflow() {
    assertThrows(MfaProtocolException.class,
        () -> codec.encode(MfaResponse.protocolError("가".repeat(21))));
  }

  @Test
  void decodedMessageDoesNotRetainMutableInput() throws Exception {
    byte[] input = request("A", "SMS", "000123", "", "");
    MfaMessage result = codec.decode(input);
    Arrays.fill(input, (byte) 'X');
    assertEquals("000123", result.rawSlice(54, 6));
    assertThrows(UnsupportedOperationException.class, () -> result.fields().set(0, "C"));
  }
}
