package com.scbk.mfa.config;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.Objects;
import java.util.Properties;

/**
 * MFA 데몬의 불변 설정 모델과 설정 파일 loader.
 *
 * <p>설정은 Java properties 파일에서 읽되 같은 항목의 환경변수가 있으면 환경변수를 우선한다. DB 비밀번호처럼
 * 민감한 값은 배포 파일에 남기지 않고 환경변수 또는 비밀 저장소로 주입하기 위한 구조다. 숫자 범위와 필수값은
 * 기동 시점에 검증하여 잘못된 설정으로 서비스가 부분 기동되는 것을 방지한다.
 *
 * @param server TCP listener와 worker 설정
 * @param database Oracle/HikariCP 설정
 * @param queries 운영 DB에 맞춰 외부화한 SQL
 * @param authTtl 인증번호 유효시간
 */
public record MfaConfig(
    Server server,
    Database database,
    Queries queries,
    Duration authTtl) {

  /**
   * 지정한 properties 파일과 현재 프로세스 환경변수로 설정을 생성한다.
   *
   * @param path 실제 설정 파일 경로
   * @return 검증이 끝난 불변 설정
   * @throws IOException 파일을 읽지 못하거나 설정값이 유효하지 않은 경우
   */
  public static MfaConfig load(Path path) throws IOException {
    Objects.requireNonNull(path, "path");
    Properties properties = new Properties();
    try (InputStream input = Files.newInputStream(path)) {
      properties.load(input);
    }
    return from(properties, System.getenv());
  }

  /**
   * 주입받은 properties와 환경변수 map으로 설정을 생성한다.
   *
   * <p>package-private인 이유는 단위 테스트에서 실제 OS 환경변수를 변경하지 않고 우선순위를 검증하기 위해서다.
   */
  static MfaConfig from(Properties p, Map<String, String> env) throws IOException {
    String bindAddress = value(p, env, "server.bind-address", "MFA_BIND_ADDRESS", "127.0.0.1");
    try {
      InetAddress.getByName(bindAddress);
    } catch (Exception e) {
      throw new IOException("server.bind-address를 해석할 수 없습니다: " + bindAddress, e);
    }

    Charset charset;
    try {
      charset = Charset.forName(value(p, env, "server.charset", "MFA_CHARSET", "EUC-KR"));
    } catch (Exception e) {
      throw new IOException("server.charset이 올바르지 않습니다", e);
    }

    Server server =
        new Server(
            bindAddress,
            integer(p, env, "server.port", "MFA_PORT", 9200, 1, 65535),
            charset,
            integer(p, env, "server.worker-threads", "MFA_WORKER_THREADS", 50, 1, 512),
            integer(p, env, "server.queue-capacity", "MFA_QUEUE_CAPACITY", 200, 1, 100_000),
            integer(p, env, "server.read-timeout-ms", "MFA_READ_TIMEOUT_MS", 5000, 100, 300_000),
            integer(p, env, "server.shutdown-timeout-seconds", "MFA_SHUTDOWN_TIMEOUT_SECONDS", 15, 1, 300));

    // 비밀번호를 포함한 DB 필수값은 기본값을 두지 않는다. 누락 시 안전하게 기동을 중단한다.
    Database database =
        new Database(
            required(p, env, "db.url", "MFA_DB_URL"),
            required(p, env, "db.username", "MFA_DB_USERNAME"),
            required(p, env, "db.password", "MFA_DB_PASSWORD"),
            value(p, env, "db.driver-class-name", "MFA_DB_DRIVER", "oracle.jdbc.OracleDriver"),
            integer(p, env, "db.maximum-pool-size", "MFA_DB_MAXIMUM_POOL_SIZE", 10, 1, 200),
            integer(p, env, "db.minimum-idle", "MFA_DB_MINIMUM_IDLE", 2, 0, 200),
            integer(p, env, "db.connection-timeout-ms", "MFA_DB_CONNECTION_TIMEOUT_MS", 5000, 250, 300_000),
            integer(p, env, "db.validation-timeout-ms", "MFA_DB_VALIDATION_TIMEOUT_MS", 3000, 250, 300_000));
    if (database.minimumIdle() > database.maximumPoolSize()) {
      throw new IOException("db.minimum-idle은 db.maximum-pool-size보다 클 수 없습니다");
    }

    // 운영 DDL이 저장소에 없으므로 SQL을 설정으로 분리했다. placeholder 순서는 Repository 계약과 같아야 한다.
    Queries queries =
        new Queries(
            required(p, env, "query.select-phone", "MFA_QUERY_SELECT_PHONE"),
            required(p, env, "query.select-sequence", "MFA_QUERY_SELECT_SEQUENCE"),
            required(p, env, "query.insert-auth-code", "MFA_QUERY_INSERT_AUTH_CODE"),
            required(p, env, "query.insert-sms", "MFA_QUERY_INSERT_SMS"),
            required(p, env, "query.select-auth-code", "MFA_QUERY_SELECT_AUTH_CODE"),
            required(p, env, "query.consume-auth-code", "MFA_QUERY_CONSUME_AUTH_CODE"));

    return new MfaConfig(
        server,
        database,
        queries,
        Duration.ofMinutes(integer(p, env, "auth.ttl-minutes", "MFA_AUTH_TTL_MINUTES", 5, 1, 60)));
  }

  /** 필수 문자열을 읽고 공백 또는 누락을 설정 오류로 처리한다. */
  private static String required(Properties p, Map<String, String> env, String key, String envKey)
      throws IOException {
    String result = value(p, env, key, envKey, null);
    if (result == null || result.isBlank()) {
      throw new IOException("필수 설정이 없습니다: " + key + " 또는 " + envKey);
    }
    return result.trim();
  }

  /** 환경변수, properties, 기본값 순서로 값을 선택한다. */
  private static String value(
      Properties p, Map<String, String> env, String key, String envKey, String defaultValue) {
    String environmentValue = env.get(envKey);
    if (environmentValue != null && !environmentValue.isBlank()) {
      return environmentValue.trim();
    }
    String propertyValue = p.getProperty(key);
    if (propertyValue != null && !propertyValue.isBlank()) {
      return propertyValue.trim();
    }
    return defaultValue;
  }

  /** 정수 설정을 읽고 각 자원의 안전한 최소·최대 범위를 검증한다. */
  private static int integer(
      Properties p,
      Map<String, String> env,
      String key,
      String envKey,
      int defaultValue,
      int minimum,
      int maximum)
      throws IOException {
    String raw = value(p, env, key, envKey, Integer.toString(defaultValue));
    try {
      int value = Integer.parseInt(raw);
      if (value < minimum || value > maximum) {
        throw new IOException(key + "의 허용 범위는 " + minimum + "~" + maximum + "입니다");
      }
      return value;
    } catch (NumberFormatException e) {
      throw new IOException(key + "는 정수여야 합니다", e);
    }
  }

  /**
   * TCP 서버 자원 제한 설정.
   *
   * @param bindAddress listener가 bind할 단일 주소. 기본값은 외부 노출을 막는 loopback
   * @param port listener 포트
   * @param charset 고정길이 전문 인코딩 문자셋
   * @param workerThreads 동시에 처리할 요청 worker 수
   * @param queueCapacity worker가 모두 사용 중일 때 기다릴 최대 요청 수
   * @param readTimeoutMillis 106바이트 전문을 완성할 최대 대기시간
   * @param shutdownTimeoutSeconds 정상 종료 시 실행 중인 worker를 기다릴 시간
   */
  public record Server(
      String bindAddress,
      int port,
      Charset charset,
      int workerThreads,
      int queueCapacity,
      int readTimeoutMillis,
      int shutdownTimeoutSeconds) {

    public Server {
      Objects.requireNonNull(bindAddress);
      Objects.requireNonNull(charset);
    }

    /** DB가 필요 없는 loopback TCP 단위 테스트용 소규모 설정을 만든다. */
    public static Server testDefaults(int port) {
      return new Server("127.0.0.1", port, StandardCharsets.US_ASCII, 2, 4, 2000, 2);
    }
  }

  /**
   * Oracle JDBC 및 HikariCP 설정.
   *
   * <p>worker 수와 maximum pool size는 같은 값일 필요가 없다. DB session 한도와 요청 처리시간을 기준으로
   * pool 크기를 정하고, connection을 기다리는 시간은 호출자의 read timeout보다 짧게 둔다.
   */
  public record Database(
      String jdbcUrl,
      String username,
      String password,
      String driverClassName,
      int maximumPoolSize,
      int minimumIdle,
      int connectionTimeoutMillis,
      int validationTimeoutMillis) {}

  /**
   * MFA 업무에서 사용하는 외부 SQL 묶음.
   *
   * <p>각 SQL의 placeholder 개수와 순서는 {@code JdbcMfaRepository}의 바인딩 순서를 따라야 한다. 상세 계약은
   * 프로젝트 루트의 {@code docs/MFA_변경비교.md}를 참고한다.
   */
  public record Queries(
      String selectPhone,
      String selectSequence,
      String insertAuthCode,
      String insertSms,
      String selectAuthCode,
      String consumeAuthCode) {}
}
