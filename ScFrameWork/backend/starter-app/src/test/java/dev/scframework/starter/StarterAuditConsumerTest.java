package dev.scframework.starter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.autoconfigure.audit.JdbcSecurityAuditSink;
import dev.scframework.core.audit.SecurityAuditPublisher;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Comparator;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/** Reference 없는 별도 앱에서 자기 migration과 공통 Security/Advice/JDBC 감사를 실제 소비한다. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("audit")
@Import(StarterAuditConsumerTest.ErrorFixtureConfiguration.class)
class StarterAuditConsumerTest {
    private static final String PASSWORD = "synthetic-starter-audit-password";
    private static final String CANARY = "synthetic-private-message-canary";
    private static final Path TEMP = createTemp();

    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE", () -> TEMP.resolve("bootstrap.secret").toString());
        registry.add("SC_BOOTSTRAP_USERNAME", () -> "audit-admin");
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:starter-audit-" + TEMP.getFileName() + ";DB_CLOSE_DELAY=-1");
        registry.add("logging.file.name", () -> TEMP.resolve("test.log").toString());
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired DataSource dataSource;
    @Autowired JdbcSecurityAuditSink sink;
    @Autowired SecurityAuditPublisher publisher;
    @Autowired @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mappings;

    @Test void filterEventsAndDefaultMeUseTheActualOptionalH2Migration() throws Exception {
        var jdbc = new JdbcTemplate(dataSource);
        jdbc.update("DELETE FROM security_audit_event");
        long meMappings = mappings.getHandlerMethods().keySet().stream()
                .filter(mapping -> mapping.getPatternValues().contains("/api/auth/me")).count();
        assertThat(meMappings).isEqualTo(1);
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").param("username", "missing-user").param("password", CANARY))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF"));
        var token = csrf(null);
        mvc.perform(post("/api/auth/login").session(token.session).header(token.header, token.value)
                .param("username", "missing-user").param("password", CANARY))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_FAILED"));
        mvc.perform(post("/api/auth/login").session(token.session).header(token.header, token.value)
                .param("username", "audit-admin").param("password", PASSWORD)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").session(token.session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("audit-admin"))
                .andExpect(jsonPath("$.roles[0]").value("ADMIN")).andExpect(jsonPath("$.id").doesNotExist());
        var logout = csrf(token.session);
        mvc.perform(post("/api/auth/logout").session(logout.session).header(logout.header, logout.value))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForList("SELECT reason_code FROM security_audit_event ORDER BY id", String.class))
                .containsExactly("AUTH_REQUIRED", "CSRF", "AUTH_FAILED", "OK", "OK");
        assertThat(jdbc.queryForObject("SELECT actor_subject FROM security_audit_event WHERE reason_code='AUTH_FAILED'", String.class))
                .isEqualTo("missing-user");
        assertNoCanary(jdbc);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_name='REFERENCE_USER'", Integer.class)).isZero();
    }

    @Test void optimisticDataAndInternalFailuresPreserveSafeJsonAndAuditOnce() throws Exception {
        var jdbc = new JdbcTemplate(dataSource);
        jdbc.update("DELETE FROM security_audit_event");
        var token = csrf(null);
        mvc.perform(post("/api/auth/login").session(token.session).header(token.header, token.value)
                .param("username", "audit-admin").param("password", PASSWORD)).andExpect(status().isNoContent());
        mvc.perform(get("/api/audit-fixture/optimistic").session(token.session)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REVISION_CONFLICT")).andExpect(jsonPath("$.errors").isArray());
        mvc.perform(get("/api/audit-fixture/fk").session(token.session)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DATA_CONFLICT"));
        var error = mvc.perform(get("/api/audit-fixture/internal").session(token.session)).andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR")).andReturn();
        assertThat(error.getResponse().getContentAsString().contains(CANARY)).isFalse();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE action='HTTP_ERROR'", Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForList("SELECT reason_code FROM security_audit_event WHERE action='HTTP_ERROR' ORDER BY id", String.class))
                .containsExactly("REVISION_CONFLICT", "DATA_CONFLICT", "INTERNAL_ERROR");
        assertNoCanary(jdbc);
    }

    private void assertNoCanary(JdbcTemplate jdbc) {
        // 부정 assertion도 민감 fixture 값/전체 감사행을 failure 출력에 넣지 않는다.
        boolean leaked = jdbc.queryForList("SELECT * FROM security_audit_event").stream()
                .flatMap(row -> row.values().stream()).filter(java.util.Objects::nonNull)
                .anyMatch(value -> value.toString().contains(CANARY) || value.toString().contains(PASSWORD));
        assertThat(leaked).isFalse();
    }
    private Token csrf(MockHttpSession existing) throws Exception {
        var request = get("/api/auth/csrf");
        if (existing != null) request.session(existing);
        var result = mvc.perform(request).andExpect(status().isOk()).andReturn();
        var payload = json.readTree(result.getResponse().getContentAsString());
        return new Token((MockHttpSession) result.getRequest().getSession(false), payload.get("headerName").asText(), payload.get("token").asText());
    }
    private record Token(MockHttpSession session, String header, String value) {}

    @TestConfiguration(proxyBeanMethods = false) static class ErrorFixtureConfiguration {
        @Bean ErrorFixture errorFixture() { return new ErrorFixture(); }
    }
    @RestController static class ErrorFixture {
        @GetMapping("/api/audit-fixture/{kind}") public String fail(@PathVariable String kind) {
            if ("optimistic".equals(kind)) throw new ObjectOptimisticLockingFailureException("synthetic-domain", 1L);
            if ("fk".equals(kind)) throw new DataIntegrityViolationException(CANARY);
            throw new IllegalStateException(CANARY);
        }
    }
    private static Path createTemp() {
        try {
            Path directory = Files.createTempDirectory("sc-starter-audit-");
            Path secret = Files.writeString(directory.resolve("bootstrap.secret"), PASSWORD);
            if (Files.getFileStore(secret).supportsFileAttributeView("posix")) Files.setPosixFilePermissions(secret, PosixFilePermissions.fromString("rw-------"));
            return directory;
        } catch (IOException exception) { throw new IllegalStateException("Could not create isolated audit fixture"); }
    }
    @AfterAll static void cleanup() throws IOException {
        try (var files = Files.walk(TEMP)) {
            for (var file : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
        }
    }
}
