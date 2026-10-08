package com.scbk.mfa;

import com.scbk.mfa.config.MfaConfig;
import com.scbk.mfa.persistence.JdbcMfaRepository;
import com.scbk.mfa.persistence.MfaDataSourceFactory;
import com.scbk.mfa.protocol.MfaCodec;
import com.scbk.mfa.server.MfaTcpServer;
import com.scbk.mfa.service.MfaService;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.file.Path;

/**
 * MFA 독립 데몬의 프로세스 진입점.
 *
 * <p>AS-IS의 {@code ServletContextListener}와 달리 WAS 생명주기에 종속되지 않는다. 설정 로드, DB
 * connection pool 생성, 업무 서비스 조립, TCP 서버 실행 순서만 담당하며 실제 프로토콜 및 업무 처리는 각
 * 계층에 위임한다.
 */
public final class MfaDaemonMain {
  private MfaDaemonMain() {}

  /**
   * 설정 파일을 읽고 MFA 서버를 foreground로 실행한다.
   *
   * <p>DB pool과 서버는 try-with-resources 및 shutdown hook으로 닫는다. 포트 bind 또는 accept가 실패하면
   * 예외를 main까지 전달하여 systemd가 비정상 종료로 감지하고 재시작할 수 있게 한다.
   *
   * @param args 선택적인 설정 파일 경로 한 개
   * @throws Exception 설정, DB pool 초기화 또는 TCP 서버 실행에 실패한 경우
   */
  public static void main(String[] args) throws Exception {
    Path configPath = resolveConfigPath(args);
    MfaConfig config = MfaConfig.load(configPath);

    // HikariDataSource를 닫아야 pool의 connection과 관리 thread가 함께 정리된다.
    try (HikariDataSource dataSource = MfaDataSourceFactory.create(config.database())) {
      JdbcMfaRepository repository = new JdbcMfaRepository(dataSource, config.queries());
      MfaService service =
          new MfaService(repository, MfaService.seoulClock(), config.authTtl().toMinutes());
      MfaTcpServer server =
          new MfaTcpServer(config.server(), new MfaCodec(config.server().charset()), service::handle);
      Thread shutdownHook =
          Thread.ofPlatform().name("mfa-shutdown").unstarted(server::close);
      Runtime.getRuntime().addShutdownHook(shutdownHook);
      try {
        // 별도 daemon thread로 숨기지 않고 foreground에서 실행한다.
        server.run();
      } finally {
        server.close();
        try {
          Runtime.getRuntime().removeShutdownHook(shutdownHook);
        } catch (IllegalStateException ignored) {
          // JVM 종료가 이미 시작된 경우 hook 제거가 허용되지 않는다.
        }
      }
    }
  }

  /**
   * 설정 파일 위치를 명령행, 환경변수, 기본값 순서로 결정한다.
   *
   * <p>우선순위는 {@code args[0] > MFA_CONFIG > conf/mfa.properties}다. 두 개 이상의 인자를 조용히
   * 무시하지 않고 즉시 실패시켜 잘못된 운영 기동 명령을 발견할 수 있게 한다.
   */
  private static Path resolveConfigPath(String[] args) {
    if (args.length > 1) {
      throw new IllegalArgumentException("사용법: java -jar mfa-daemon.jar [설정파일 경로]");
    }
    if (args.length == 1 && !args[0].isBlank()) {
      return Path.of(args[0]);
    }
    String environmentPath = System.getenv("MFA_CONFIG");
    return Path.of(environmentPath == null || environmentPath.isBlank() ? "conf/mfa.properties" : environmentPath);
  }
}
