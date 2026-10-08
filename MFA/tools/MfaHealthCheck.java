import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Properties;

/** JDK 21 source-file launcher용. DB/문자 발급 없이 Z 전문의 E/400 응답만 확인한다. */
public final class MfaHealthCheck {
  public static void main(String[] args) {
    int exit;
    try {
      if (args.length != 1) throw new IllegalArgumentException();
      Properties p = new Properties();
      try (InputStream input = Files.newInputStream(Path.of(args[0]))) { p.load(input); }
      String host = setting(p, "health.host", "MFA_HEALTH_HOST",
          setting(p, "server.bind-address", "MFA_BIND_ADDRESS", "127.0.0.1"));
      if (host.equals("0.0.0.0") || host.equals("::")) host = "127.0.0.1";
      int port = Integer.parseInt(setting(p, "server.port", "MFA_PORT", "9200"));
      int timeout = Integer.parseInt(setting(p, "health.timeout-ms", "MFA_HEALTH_TIMEOUT_MS", "3000"));
      if (port < 1 || port > 65535 || timeout < 100 || timeout > 30000) throw new IllegalArgumentException();
      exit = probe(host, port, timeout);
    } catch (IllegalArgumentException | java.nio.file.NoSuchFileException e) {
      System.err.println("FAIL: HealthCheck 설정을 확인하세요.");
      exit = 64;
    } catch (Exception e) {
      // 예외 메시지/설정 원문을 출력하지 않는다.
      System.err.println("FAIL: TCP 연결 또는 응답 실패 (" + e.getClass().getSimpleName() + ")");
      exit = 2;
    }
    System.exit(exit);
  }

  private static int probe(String host, int port, int timeout) throws Exception {
    byte[] request = new byte[106];
    Arrays.fill(request, (byte) ' ');
    request[0] = 'Z'; // 지원하지 않는 유형: MfaService에서 DB 접근 없이 E/400 반환.
    try (Socket socket = new Socket()) {
      socket.connect(new InetSocketAddress(host, port), timeout);
      socket.getOutputStream().write(request);
      byte[] reply = new byte[106];
      int offset = 0;
      long deadline = System.nanoTime() + timeout * 1_000_000L;
      while (offset < reply.length) {
        long remaining = deadline - System.nanoTime();
        if (remaining <= 0) throw new java.net.SocketTimeoutException();
        socket.setSoTimeout((int) Math.max(1, remaining / 1_000_000L));
        int size = socket.getInputStream().read(reply, offset, reply.length - offset);
        if (size < 0) break;
        offset += size;
      }
      if (offset != 106 || !new String(reply, 0, 4, StandardCharsets.US_ASCII).equals("E400")) {
        System.err.println("FAIL: MFA 예상 응답 불일치");
        return 3;
      }
      System.out.println("OK: MFA TCP 응답 정상 (DB/SMS 상태는 검사하지 않음)");
      return 0;
    }
  }

  private static String setting(Properties p, String key, String env, String fallback) {
    String value = System.getenv(env);
    if (value == null || value.isBlank()) value = p.getProperty(key, fallback);
    return value.trim();
  }
}
