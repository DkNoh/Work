package dev.scframework.reference.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.scframework.core.audit.SecurityAuditEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.audit.SecurityAuditPublisher;
import dev.scframework.reference.identity.UserEntity;
import dev.scframework.reference.identity.UserRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("dev")
class AuditControllerTest {
    private static final String PASSWORD = "synthetic-reference-audit-password";
    private static final Path TEMP = createTemp();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE", () -> TEMP.resolve("bootstrap.secret").toString());
        registry.add("SC_BOOTSTRAP_USERNAME", () -> "audit-admin");
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:reference-audit-" + TEMP.getFileName() + ";DB_CLOSE_DELAY=-1");
        registry.add("logging.file.name", () -> TEMP.resolve("test.log").toString());
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired SecurityAuditPublisher publisher;
    @Autowired DataSource dataSource;
    private long adminId;

    @BeforeEach void prepare() {
        adminId = users.findByUsername("audit-admin").orElseThrow().getId();
        if (users.findByUsername("audit-reviewer").isEmpty())
            users.saveAndFlush(new UserEntity("audit-reviewer", "합성 검토자", encoder.encode(PASSWORD), "REVIEWER", Instant.now()));
        new JdbcTemplate(dataSource).update("DELETE FROM security_audit_event");
        publisher.publish(new SecurityAuditEvent("audit-admin", adminId, Instant.parse("2026-10-06T01:00:00Z"),
                "TEST_CHANGE", "SUCCESS", "REQUIREMENT", "1", "audit-request-1", null));
        publisher.publish(new SecurityAuditEvent("unknown-user", null, Instant.parse("2026-10-06T02:00:00Z"),
                "AUTH_LOGIN", "FAILURE", "HTTP", null, "audit-request-2", "AUTH_FAILED"));
    }

    @Test @WithMockUser(username = "audit-admin", roles = "ADMIN")
    void pagedLatestAndBoundFiltersReturnOnlyTheOwnSafeDto() throws Exception {
        var response = mvc.perform(get("/api/audit/events").param("size", "1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.items[0].actorSubject").value("unknown-user"))
                .andExpect(jsonPath("$.items[0].actorId").doesNotExist())
                .andExpect(jsonPath("$.items[0].password").doesNotExist())
                .andExpect(jsonPath("$.items[0].passwordHash").doesNotExist()).andReturn();
        assertThat(response.getResponse().getContentAsString().contains(PASSWORD)).isFalse();
        var payload = json.readTree(response.getResponse().getContentAsString());
        Set<String> pageKeys = new HashSet<>();
        payload.fieldNames().forEachRemaining(pageKeys::add);
        Set<String> itemKeys = new HashSet<>();
        payload.get("items").get(0).fieldNames().forEachRemaining(itemKeys::add);
        assertThat(pageKeys).containsExactlyInAnyOrder("items", "total", "page", "size");
        assertThat(itemKeys).containsExactlyInAnyOrder("id", "actorSubject", "actorId", "occurredAt", "action", "outcome", "resourceType", "resourceId", "requestId", "reasonCode");
        mvc.perform(get("/api/audit/events").param("action", "TEST_CHANGE").param("outcome", "SUCCESS")
                .param("actorSubject", "audit-admin").param("from", "2026-10-06T00:00:00Z").param("to", "2026-10-06T01:30:00Z"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].actorId").value(adminId));
        mvc.perform(get("/api/audit/events").param("page", "1").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].action").value("TEST_CHANGE"));
    }

    @Test @WithMockUser(username = "audit-reviewer", roles = "ADMIN")
    void currentDbRoleRejectsStaleAdminSessionAndRecordsDenied() throws Exception {
        mvc.perform(get("/api/audit/events")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertThat(new JdbcTemplate(dataSource).queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE outcome='DENIED'", Integer.class)).isEqualTo(1);
    }

    @Test @WithMockUser(username = "audit-admin", roles = "ADMIN")
    void invalidBoundsAndSqlLikeInputAreRejectedWithoutExposingIt() throws Exception {
        for (String size : new String[]{"0", "101"}) mvc.perform(get("/api/audit/events").param("size", size)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/audit/events").param("page", "-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/audit/events").param("page", "1000001")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/audit/events").param("action", "' OR 1=1 --")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/audit/events").param("from", "2026-10-07T00:00:00Z").param("to", "2026-10-06T00:00:00Z"))
                .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(username = "audit-admin", roles = "ADMIN")
    void liveOpenApiDescribesAlwaysPresentNullableAuditFieldsAndOutcomeCodes() throws Exception {
        var response = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn();
        var schemas = json.readTree(response.getResponse().getContentAsString()).get("components").get("schemas");
        var item = schemas.get("AuditItem");
        Set<String> required = new HashSet<>();
        item.get("required").forEach(value -> required.add(value.asText()));
        assertThat(required).containsExactlyInAnyOrder("id", "actorSubject", "actorId", "occurredAt", "action", "outcome", "resourceType", "resourceId", "requestId", "reasonCode");
        for (String field : new String[]{"actorId", "resourceId", "requestId", "reasonCode"}) {
            Set<String> types = new HashSet<>();
            item.get("properties").get(field).get("type").forEach(value -> types.add(value.asText()));
            assertThat(types).containsExactlyInAnyOrder("actorId".equals(field) ? "integer" : "string", "null");
        }
        Set<String> outcomes = new HashSet<>();
        item.get("properties").get("outcome").get("enum").forEach(value -> outcomes.add(value.asText()));
        assertThat(outcomes).containsExactlyInAnyOrder("SUCCESS", "FAILURE", "DENIED");
        assertThat(schemas.get("AuditPage").get("properties").get("size").get("maximum").asInt()).isEqualTo(100);
    }

    private static Path createTemp() {
        try {
            Path directory = Files.createTempDirectory("sc-reference-audit-");
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
