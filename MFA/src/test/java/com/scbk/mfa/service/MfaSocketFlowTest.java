package com.scbk.mfa.service;

import static org.junit.jupiter.api.Assertions.*;
import static com.scbk.mfa.support.TestFrames.request;

import com.scbk.mfa.config.MfaConfig;
import com.scbk.mfa.protocol.MfaCodec;
import com.scbk.mfa.server.MfaTcpServer;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * JSP의 A/B → C/D 전문을 실제 TCP 서버와 업무 서비스에 연속 전송한다.
 * DB/SMS만 메모리 저장소로 대체하며 실제 JSP 실행, Oracle 연결, 문자 발송 테스트는 아니다.
 */
class MfaSocketFlowTest {
  private static final String CHANNEL = "SMSADMIN";
  private static final String CLERK_NUMBER = "000123";
  // 외부로 발송되지 않는 테스트 전용 값이다. 선행 0을 포함한 6자리 필드 보존도 검증한다.
  private static final String TEST_CODE = "000007";

  private final StatefulRepository repository = new StatefulRepository();
  private final AtomicReference<Throwable> serverError = new AtomicReference<>();
  private MfaTcpServer server;
  private Thread thread;

  @BeforeEach
  void startServer() {
    Charset charset = Charset.forName("EUC-KR");
    MfaService service = new MfaService(repository,
        Clock.fixed(Instant.parse("2026-10-07T03:00:00Z"), ZoneId.of("Asia/Seoul")),
        5, () -> TEST_CODE);
    server = new MfaTcpServer(new MfaConfig.Server("127.0.0.1", 0, charset, 1, 4, 2000, 2),
        new MfaCodec(charset), service::handle);
    thread = new Thread(() -> { try { server.run(); } catch (Throwable e) { serverError.set(e); } });
    thread.start();
    assertTimeoutPreemptively(Duration.ofSeconds(3), () -> {
      while (!server.isRunning()) {
        if (serverError.get() != null) fail(serverError.get());
        Thread.sleep(5);
      }
    });
  }

  @AfterEach
  void stopServer() throws Exception {
    if (server != null) server.close();
    if (thread != null) { thread.join(3000); assertFalse(thread.isAlive()); }
    assertNull(serverError.get());
  }

  @Test
  void issuesAndVerifiesWithJspHalfCloseAndReadLine() throws Exception {
    String issued = exchangeLikeJsp(request("A", CHANNEL, CLERK_NUMBER, "", ""));
    assertEquals("B200", issued.substring(0, 4));

    // JSP가 사용하는 실제 offset으로 시퀀스(20자리)와 OTP(6자리)를 각각 읽는다.
    String sequence = issued.substring(60, 80).trim();
    String code = issued.substring(80, 86);
    assertEquals("SMSA20261007120000", sequence);
    assertEquals(TEST_CODE, code);
    assertEquals(sequence, repository.issued().authenticationSequence());
    assertEquals(CLERK_NUMBER, repository.issued().clerkNumber());
    assertEquals(CHANNEL, repository.issued().requestChannel());

    assertVerification("401", "UNKNOWN", code);
    assertVerification("401", sequence, "999999");
    assertEquals(0, repository.consumed());
    assertVerification("200", sequence, code);
    assertVerification("401", sequence, code);
    assertEquals(1, repository.consumed());
  }

  private void assertVerification(String expectedCode, String sequence, String code) throws Exception {
    String response = exchangeLikeJsp(request("C", CHANNEL, CLERK_NUMBER, sequence, code));
    assertEquals("D", response.substring(0, 1));
    assertEquals(expectedCode, response.substring(1, 4));
  }

  private String exchangeLikeJsp(byte[] requestFrame) throws Exception {
    try (Socket socket = new Socket()) {
      socket.connect(new InetSocketAddress("127.0.0.1", server.localPort()), 1000);
      socket.setSoTimeout(2000);
      // AS-IS JSP처럼 기본 charset을 사용한다. 이 시나리오의 송수신 전문은 ASCII뿐이다.
      // 운영의 한글 응답/default charset 조합까지 호환성을 보장하는 테스트는 아니다.
      String sendData = new String(requestFrame, StandardCharsets.US_ASCII);
      byte[] encoded = sendData.getBytes();
      assertEquals(106, encoded.length);
      socket.getOutputStream().write(encoded);
      socket.getOutputStream().flush();
      socket.shutdownOutput();

      BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
      String response = reader.readLine();
      assertNotNull(response);
      assertEquals(106, response.length());
      assertTrue(response.chars().allMatch(value -> value <= 0x7f));
      // 데몬은 줄바꿈 없이 106바이트를 보낸 뒤 닫으므로 EOF가 readLine()을 완료한다.
      assertNull(reader.readLine());
      return response;
    }
  }

  /** 발급한 시퀀스와 인증번호가 함께 일치하고 미사용 상태인 경우에만 검증을 허용한다. */
  private static final class StatefulRepository implements MfaRepository {
    private IssueCommand issued;
    private int consumed;

    public String findPhoneNumber(String id) { return CLERK_NUMBER.equals(id) ? "01000000000" : ""; }
    public String nextSmsSequence() { return "1"; }
    public synchronized void issue(IssueCommand value) { issued = value; consumed = 0; }

    public synchronized Optional<String> findExpiration(String seq, String code) {
      return matches(seq, code) ? Optional.of(issued.expirationTimestamp()) : Optional.empty();
    }

    public synchronized int consume(String seq, String code, String date, String time, String timestamp) {
      if (!matches(seq, code)) return 0;
      consumed++;
      return 1;
    }

    private boolean matches(String seq, String code) {
      return issued != null && consumed == 0
          && issued.authenticationSequence().equals(seq) && issued.authenticationCode().equals(code);
    }

    synchronized IssueCommand issued() { return issued; }
    synchronized int consumed() { return consumed; }
  }
}
