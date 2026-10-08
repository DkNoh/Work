package com.scbk.mfa.persistence;

import com.scbk.mfa.config.MfaConfig;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

/** Oracle 접속 설정으로 MFA 전용 HikariCP connection pool을 생성한다. */
public final class MfaDataSourceFactory {
  private MfaDataSourceFactory() {}

  /**
   * 검증이 끝난 DB 설정을 HikariCP 설정으로 변환한다.
   *
   * <p>반환된 {@link HikariDataSource}는 프로세스 종료 시 반드시 close해야 한다. JMX 등록은 운영에서
   * active/idle/pending connection을 관찰하기 위한 것이며 외부 JMX 포트 개방을 의미하지는 않는다.
   *
   * @param database JDBC URL, 계정, driver 및 pool 제한
   * @return 초기화된 MFA 전용 DataSource
   */
  public static HikariDataSource create(MfaConfig.Database database) {
    HikariConfig hikari = new HikariConfig();
    hikari.setPoolName("mfa-db-pool");
    hikari.setJdbcUrl(database.jdbcUrl());
    hikari.setUsername(database.username());
    hikari.setPassword(database.password());
    hikari.setDriverClassName(database.driverClassName());
    hikari.setMaximumPoolSize(database.maximumPoolSize());
    hikari.setMinimumIdle(database.minimumIdle());
    hikari.setConnectionTimeout(database.connectionTimeoutMillis());
    hikari.setValidationTimeout(database.validationTimeoutMillis());
    // 단건 조회는 auto-commit을 사용하고 발급 transaction은 Repository가 일시적으로 false로 바꾼다.
    hikari.setAutoCommit(true);
    hikari.setRegisterMbeans(true);
    return new HikariDataSource(hikari);
  }
}
