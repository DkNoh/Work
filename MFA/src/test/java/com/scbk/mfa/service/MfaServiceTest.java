package com.scbk.mfa.service;

import static org.junit.jupiter.api.Assertions.*;
import static com.scbk.mfa.support.TestFrames.request;

import com.scbk.mfa.protocol.*;
import java.nio.charset.Charset;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class MfaServiceTest {
  private final FakeRepository repository = new FakeRepository();
  private final MfaCodec codec = new MfaCodec(Charset.forName("EUC-KR"));
  // 시각과 인증번호를 고정해 만료 경계/선행 0을 재현한다. 외부 발송은 없다.
  private final MfaService service = new MfaService(repository,
      Clock.fixed(Instant.parse("2026-10-07T03:00:00Z"), ZoneId.of("Asia/Seoul")), 5, () -> "000007");

  @Test
  void issuesCodeAndQueueCommandWithFiveMinuteExpiry() throws Exception {
    MfaMessage result = call("A", "SMS", "000123", "", "");
    assertEquals("B", result.type());
    assertEquals("200", result.responseCode());
    assertEquals("000007", result.authenticationCode());
    assertEquals("000123", repository.issued.clerkNumber());
    assertEquals("01000000000", repository.issued.phoneNumber());
    assertEquals("20261007120500", repository.issued.expirationTimestamp());
    assertEquals(result.authenticationSequence(), repository.issued.authenticationSequence());
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "ABC", "12 34", "-123"})
  void rejectsInvalidIdWithoutIssuing(String id) throws Exception {
    assertNotEquals("200", call("A", "SMS", id, "", "").responseCode());
    assertNull(repository.issued);
  }

  @Test
  void rejectsMissingChannel() throws Exception {
    assertEquals("400", call("A", "", "000123", "", "").responseCode());
    assertNull(repository.issued);
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "123", "0200000000"})
  void rejectsMissingOrInvalidPhone(String phone) throws Exception {
    repository.phone = phone;
    assertEquals("404", call("A", "SMS", "000123", "", "").responseCode());
    assertNull(repository.issued);
  }

  @Test
  void masksRepositoryFailure() throws Exception {
    repository.fail = true;
    MfaMessage result = call("A", "SMS", "000123", "", "");
    assertEquals("500", result.responseCode());
    assertTrue(result.authenticationCode().isEmpty());
    assertTrue(result.authenticationSequence().isEmpty());
  }

  @Test
  void acceptsExactExpiryAndConsumesOnlyOnce() throws Exception {
    repository.expiration = Optional.of("20261007120000");
    assertEquals("200", call("C", "", "", "SEQ", "000007").responseCode());
    assertEquals("401", call("C", "", "", "SEQ", "000007").responseCode());
    assertEquals(1, repository.consumed);
  }

  @Test
  void rejectsExpiredCodeWithoutConsuming() throws Exception {
    repository.expiration = Optional.of("20261007115959");
    assertEquals("401", call("C", "", "", "SEQ", "000007").responseCode());
    assertEquals(0, repository.consumed);
  }

  @Test
  void rejectsUnknownCode() throws Exception {
    repository.expiration = Optional.empty();
    assertEquals("401", call("C", "", "", "SEQ", "999999").responseCode());
    assertEquals(0, repository.consumed);
  }

  @Test
  void rejectsLostConcurrentConsume() throws Exception {
    repository.updated = 0;
    assertEquals("401", call("C", "", "", "SEQ", "000007").responseCode());
  }

  @Test
  void rejectsMissingVerificationFields() throws Exception {
    assertEquals("400", call("C", "", "", "", "000007").responseCode());
    assertEquals("400", call("C", "", "", "SEQ", "").responseCode());
  }

  @Test
  void verificationDatabaseErrorIsFailure() throws Exception {
    repository.fail = true;
    assertEquals("500", call("C", "", "", "SEQ", "000007").responseCode());
  }

  @Test
  void healthProbeTypeDoesNotUseDatabase() throws Exception {
    repository.fail = true;
    MfaMessage result = call("Z", "", "", "", "");
    assertEquals("E", result.type());
    assertEquals("400", result.responseCode());
    assertEquals(0, repository.calls);
  }

  private MfaMessage call(String type, String channel, String id, String seq, String code) throws Exception {
    return codec.decode(codec.encode(service.handle(codec.decode(request(type, channel, id, seq, code)))));
  }

  private static final class FakeRepository implements MfaRepository {
    private String phone = "010-0000-0000";
    private IssueCommand issued;
    private Optional<String> expiration = Optional.of("20261007120500");
    private int consumed;
    private int updated = 1;
    private int calls;
    private boolean fail;

    private void check() throws SQLException {
      calls++;
      if (fail) throw new SQLException("synthetic test failure");
    }
    public String findPhoneNumber(String id) throws SQLException { check(); return phone; }
    public String nextSmsSequence() throws SQLException { check(); return "1"; }
    public void issue(IssueCommand value) throws SQLException { check(); issued = value; }
    public Optional<String> findExpiration(String seq, String code) throws SQLException {
      check(); return expiration;
    }
    public int consume(String seq, String code, String date, String time, String timestamp) throws SQLException {
      check();
      if (updated == 1) { consumed++; expiration = Optional.empty(); }
      return updated;
    }
  }
}
