package com.scbk.mfa.server;

import static org.junit.jupiter.api.Assertions.*;

import com.scbk.mfa.config.MfaConfig;
import com.scbk.mfa.protocol.MfaCodec;
import com.scbk.mfa.protocol.MfaResponse;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** 새 쉘의 성공/실패 종료코드와 프로세스 생명주기를 검증한다. 실제 MFA/DB 기동은 하지 않는다. */
class ShellToolsTest {
  @TempDir Path temporary;
  private final Path root = Path.of("").toAbsolutePath();

  @ParameterizedTest
  @ValueSource(strings = {"local", "dev"})
  void healthcheckUsesEnvironmentConfigWithoutIssuing(String environment) throws Exception {
    AtomicReference<String> requestedType = new AtomicReference<>();
    try (MfaTcpServer server = new MfaTcpServer(MfaConfig.Server.testDefaults(0),
        new MfaCodec(StandardCharsets.US_ASCII), message -> {
          requestedType.set(message.type());
          return MfaResponse.protocolError("Request Message Error");
        })) {
      Thread thread = start(server);
      try {
        Path config = config(server.localPort());
        assertEquals(0, run("healthcheck.sh", environment, null, Map.of("MFA_CONFIG", config.toString())));
        assertEquals("Z", requestedType.get());
      } finally { server.close(); thread.join(3000); }
    }
  }

  @Test
  void unexpectedProtocolResponseFails() throws Exception {
    try (MfaTcpServer server = new MfaTcpServer(MfaConfig.Server.testDefaults(0),
        new MfaCodec(StandardCharsets.US_ASCII), message -> MfaResponse.serverBusy())) {
      Thread thread = start(server);
      try {
        assertEquals(3, run("healthcheck.sh", "local", null,
            Map.of("MFA_CONFIG", config(server.localPort()).toString())));
      } finally { server.close(); thread.join(3000); }
    }
  }

  @Test
  void closedPortFailsInsteadOfReportingHealthy() throws Exception {
    int port;
    try (ServerSocket unused = new ServerSocket(0)) { port = unused.getLocalPort(); }
    assertEquals(2, run("healthcheck.sh", "local", null, Map.of("MFA_CONFIG", config(port).toString())));
  }

  @Test
  void missingConfigAndUnknownEnvironmentFail() throws Exception {
    assertEquals(64, run("healthcheck.sh", "local", null,
        Map.of("MFA_CONFIG", temporary.resolve("missing.properties").toString())));
    assertEquals(64, run("healthcheck.sh", "prod", null, Map.of()));
  }

  @ParameterizedTest
  @ValueSource(strings = {"local", "dev"})
  void lifecycleScriptStartsOnceAndStopsOnlyOwnedFixture(String environment) throws Exception {
    int port;
    try (ServerSocket unused = new ServerSocket(0)) { port = unused.getLocalPort(); }
    Path config = config(port);
    Path fakeJar = Files.createFile(temporary.resolve("fixture.jar"));
    Path wrapper = temporary.resolve("java-wrapper.sh");
    String java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
    String classpath = root.resolve("target/test-classes") + ":" + root.resolve("target/classes");
    // JVM 옵션/설정 전달은 실제 shell을 통과한다. 업무 JVM만 DB 없는 fixture로 바꾼다.
    Files.writeString(wrapper, "#!/usr/bin/env bash\nset -e\n"
        + "if [[ \"$1\" == '-version' || \"$1\" == *.java ]]; then exec " + quote(java) + " \"$@\"; fi\n"
        + "exec " + quote(java) + " -cp " + quote(classpath)
        + " com.scbk.mfa.server.ShellToolsTest\\$LifecycleFixture \"$@\"\n");
    assertTrue(wrapper.toFile().setExecutable(true));
    Map<String,String> env = Map.of("MFA_CONFIG", config.toString(), "MFA_JAVA", wrapper.toString(),
        "MFA_JAR", fakeJar.toString(), "MFA_RUN_DIR", temporary.resolve("run").toString(),
        "MFA_LOG_DIR", temporary.resolve("logs").toString(), "MFA_START_WAIT_SECONDS", "8", "MFA_STOP_WAIT_SECONDS", "8");
    Path pid = temporary.resolve("run/mfa-" + environment + ".pid");
    try {
      assertEquals(0, run("mfa.sh", environment, "start", env));
      String firstPid = Files.readString(pid);
      assertEquals(0, run("mfa.sh", environment, "start", env));
      assertEquals(firstPid, Files.readString(pid));
      assertEquals(0, run("mfa.sh", environment, "status", env));
    } finally {
      assertEquals(0, run("mfa.sh", environment, "stop", env));
    }
    assertEquals(3, run("mfa.sh", environment, "status", env));
    assertFalse(Files.exists(pid));
  }

  @Test
  void stalePidCannotStopAnUnrelatedProcess() throws Exception {
    Path runDir = Files.createDirectory(temporary.resolve("run"));
    Files.writeString(runDir.resolve("mfa-local.pid"), ProcessHandle.current().pid() + " 0\n");
    assertEquals(0, run("mfa.sh", "local", "stop", Map.of("MFA_RUN_DIR", runDir.toString(),
        "MFA_LOG_DIR", temporary.resolve("logs").toString())));
    assertTrue(ProcessHandle.current().isAlive());
  }

  private Thread start(MfaTcpServer server) {
    Thread thread = new Thread(() -> {
      try { server.run(); } catch (Exception e) { throw new IllegalStateException(e); }
    });
    thread.start();
    assertTimeoutPreemptively(Duration.ofSeconds(3), () -> {
      while (!server.isRunning()) Thread.sleep(5);
    });
    return thread;
  }

  private Path config(int port) throws Exception {
    Path config = temporary.resolve("mfa.properties");
    Files.writeString(config, "server.bind-address=127.0.0.1\nserver.port=" + port + "\nhealth.timeout-ms=500\n");
    return config;
  }

  private int run(String file, String environment, String action, Map<String,String> extra) throws Exception {
    ProcessBuilder builder = action == null
        ? new ProcessBuilder(root.resolve("bin/" + file).toString(), environment)
        : new ProcessBuilder(root.resolve("bin/" + file).toString(), environment, action);
    builder.environment().keySet().removeIf(key -> key.startsWith("MFA_"));
    builder.environment().putAll(extra);
    Path log = Files.createTempFile(temporary, "command-", ".log");
    builder.redirectErrorStream(true).redirectOutput(log.toFile());
    Process process = builder.start();
    boolean done = process.waitFor(20, TimeUnit.SECONDS);
    if (!done) process.destroyForcibly();
    assertTrue(done, "shell timeout");
    // 로그에는 이 테스트가 만든 설정/fixture 출력만 있다.
    if (process.exitValue() == 1) fail(Files.readString(log));
    return process.exitValue();
  }

  private static String quote(String value) { return "'" + value.replace("'", "'\"'\"'") + "'"; }

  public static final class LifecycleFixture {
    public static void main(String[] args) throws Exception {
      var p = new java.util.Properties();
      try (var input = Files.newInputStream(Path.of(args[args.length - 1]))) { p.load(input); }
      try (MfaTcpServer server = new MfaTcpServer(MfaConfig.Server.testDefaults(Integer.parseInt(p.getProperty("server.port"))),
          new MfaCodec(StandardCharsets.US_ASCII), message -> MfaResponse.protocolError("Request Message Error"))) {
        Runtime.getRuntime().addShutdownHook(new Thread(server::close));
        server.run();
      }
    }
  }
}
