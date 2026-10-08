package com.scbk.mfa.config;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.util.Map;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class MfaConfigTest {
  private Properties settings() {
    Properties p = new Properties();
    // 테스트용 필수값이며 실제 접속/SQL 실행은 하지 않는다.
    p.setProperty("db.url", "jdbc:test:unused");
    p.setProperty("db.username", "test-only");
    p.setProperty("db.password", "test-only");
    for (String key : new String[] {"select-phone", "select-sequence", "insert-auth-code",
        "insert-sms", "select-auth-code", "consume-auth-code"}) p.setProperty("query." + key, "test-only");
    return p;
  }

  @Test
  void environmentOverridesFileAndDefaultsRemain() throws Exception {
    Properties p = settings();
    p.setProperty("server.port", "19200");
    MfaConfig config = MfaConfig.from(p, Map.of("MFA_PORT", "19201"));
    assertEquals(19201, config.server().port());
    assertEquals("EUC-KR", config.server().charset().name());
    assertEquals(5, config.authTtl().toMinutes());
  }

  @Test
  void missingRequiredSettingFailsBeforeStartup() {
    Properties p = settings();
    p.remove("query.insert-sms");
    assertThrows(IOException.class, () -> MfaConfig.from(p, Map.of()));
  }

  @ParameterizedTest
  @ValueSource(strings = {"0", "65536", "invalid"})
  void rejectsInvalidPort(String port) {
    assertThrows(IOException.class, () -> MfaConfig.from(settings(), Map.of("MFA_PORT", port)));
  }

  @Test
  void rejectsPoolIdleAboveMaximum() {
    assertThrows(IOException.class, () -> MfaConfig.from(settings(),
        Map.of("MFA_DB_MAXIMUM_POOL_SIZE", "1", "MFA_DB_MINIMUM_IDLE", "2")));
  }
}
