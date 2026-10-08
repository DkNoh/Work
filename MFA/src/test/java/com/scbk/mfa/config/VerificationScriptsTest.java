package com.scbk.mfa.config;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Sonar 서버로 전송하지 않고 신규 검사 쉘의 설정 누락/토큰 전달 계약만 검증한다. */
class VerificationScriptsTest {
  @TempDir Path temporary;
  private final Path root = Path.of("").toAbsolutePath();

  @Test
  void missingSonarConfigurationStopsBeforeNetwork() throws Exception {
    Result result = run(Map.of(), "--check-config");
    assertEquals(64, result.exit());
    assertTrue(result.output().contains("SONAR_HOST_URL"));
  }

  @Test
  void configCheckDoesNotRunMavenOrExposeToken() throws Exception {
    Result result = run(Map.of("SONAR_HOST_URL", "http://test.invalid", "SONAR_PROJECT_KEY", "test-only",
        "SONAR_TOKEN", "synthetic-token-never-used", "PATH", fakeMavenPath()), "--check-config");
    assertEquals(0, result.exit());
    assertFalse(Files.exists(temporary.resolve("arguments.txt")));
    assertFalse(result.output().contains("synthetic-token-never-used"));
  }

  @Test
  void scanUsesEnvironmentTokenAndWaitsForQualityGate() throws Exception {
    Result result = run(Map.of("SONAR_HOST_URL", "http://test.invalid", "SONAR_PROJECT_KEY", "test-only",
        "SONAR_TOKEN", "synthetic-token-never-used", "PATH", fakeMavenPath()));
    assertEquals(0, result.exit());
    String arguments = Files.readString(temporary.resolve("arguments.txt"));
    assertTrue(arguments.contains("-Psonar"));
    assertTrue(arguments.contains("-Dsonar.qualitygate.wait=true"));
    assertTrue(arguments.contains("sonar:sonar"));
    assertFalse(arguments.contains("synthetic-token-never-used"));
    assertFalse(arguments.contains("sonar.token"));
    assertEquals("present", Files.readString(temporary.resolve("token-present.txt")).trim());
  }

  private String fakeMavenPath() throws Exception {
    Path bin = Files.createDirectories(temporary.resolve("bin"));
    Path mvn = bin.resolve("mvn");
    // 실제 mvn/서버 요청 없이 인자와 토큰 존재 여부만 저장한다.
    Files.writeString(mvn, "#!/usr/bin/env bash\n"
        + "printf '%s\\n' \"$@\" > \"$CHECK_DIR/arguments.txt\"\n"
        + "[[ -n \"${SONAR_TOKEN:-}\" ]] && printf 'present\\n' > \"$CHECK_DIR/token-present.txt\"\n");
    assertTrue(mvn.toFile().setExecutable(true));
    return bin + ":" + System.getenv("PATH");
  }

  private Result run(Map<String,String> extra, String... args) throws Exception {
    var command = new java.util.ArrayList<String>();
    command.add(root.resolve("bin/sonar.sh").toString());
    command.addAll(java.util.List.of(args));
    ProcessBuilder builder = new ProcessBuilder(command).redirectErrorStream(true);
    builder.environment().keySet().removeIf(key -> key.startsWith("SONAR_"));
    builder.environment().putAll(extra);
    builder.environment().put("CHECK_DIR", temporary.toString());
    Path output = Files.createTempFile(temporary, "output-", ".txt");
    builder.redirectOutput(output.toFile());
    Process process = builder.start();
    boolean finished = process.waitFor(10, TimeUnit.SECONDS);
    if (!finished) process.destroyForcibly();
    assertTrue(finished);
    return new Result(process.exitValue(), Files.readString(output));
  }
  private record Result(int exit, String output) {}
}
