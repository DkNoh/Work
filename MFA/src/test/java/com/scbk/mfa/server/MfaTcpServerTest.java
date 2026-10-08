package com.scbk.mfa.server;

import static org.junit.jupiter.api.Assertions.*;
import static com.scbk.mfa.support.TestFrames.request;

import com.scbk.mfa.config.MfaConfig;
import com.scbk.mfa.protocol.*;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** 실제 loopback TCP와 임시 포트 사용. 외부 서버/DB/문자 발송에 의존하지 않는다. */
class MfaTcpServerTest {
  private final MfaCodec codec = new MfaCodec(StandardCharsets.US_ASCII);
  private final AtomicReference<Throwable> serverError = new AtomicReference<>();
  private MfaTcpServer server;
  private Thread thread;

  @BeforeEach
  void startServer() {
    server = new MfaTcpServer(new MfaConfig.Server("127.0.0.1", 0, StandardCharsets.US_ASCII, 2, 4, 200, 2),
        codec, message -> message.type().equals("C")
            ? MfaResponse.verify("200", "Success") : MfaResponse.protocolError("Request Message Error"));
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
  void respondsWithoutClientClosingOutput() throws Exception {
    try (Socket socket = connect()) {
      socket.getOutputStream().write(request("C", "", "", "SEQ", "000007"));
      MfaMessage response = codec.decode(socket.getInputStream().readNBytes(106));
      assertEquals("D", response.type());
      assertEquals("200", response.responseCode());
      assertEquals(-1, socket.getInputStream().read());
    }
  }

  @Test
  void rejectsShortFrame() throws Exception {
    try (Socket socket = connect()) {
      socket.getOutputStream().write('A');
      socket.shutdownOutput();
      MfaMessage response = codec.decode(socket.getInputStream().readNBytes(106));
      assertEquals("E", response.type());
      assertEquals("400", response.responseCode());
    }
  }

  @Test
  void closesClientThatDoesNotCompleteFrame() throws Exception {
    try (Socket socket = connect()) {
      socket.getOutputStream().write('A');
      assertEquals(-1, socket.getInputStream().read());
    }
  }

  @Test
  void healthProbeReceivesProtocolErrorWithoutIssuance() throws Exception {
    try (Socket socket = connect()) {
      socket.getOutputStream().write(request("Z", "", "", "", ""));
      MfaMessage response = codec.decode(socket.getInputStream().readNBytes(106));
      assertEquals("E", response.type());
      assertEquals("400", response.responseCode());
    }
  }

  @Test
  void shutdownReleasesListeningPort() throws Exception {
    int port = server.localPort();
    server.close();
    thread.join(3000);
    try (ServerSocket replacement = new ServerSocket()) {
      replacement.setReuseAddress(true);
      replacement.bind(new InetSocketAddress("127.0.0.1", port));
      assertEquals(port, replacement.getLocalPort());
    }
  }

  private Socket connect() throws Exception {
    Socket socket = new Socket();
    socket.connect(new InetSocketAddress("127.0.0.1", server.localPort()), 1000);
    socket.setSoTimeout(2000);
    return socket;
  }
}
