package dev.scframework.reference.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PasswordIntegrationTest {
    private static final String OLD = "synthetic-old-password-010";
    private static final String NEW = "synthetic-new-password-010";
    private static final Path TEMP = temporarySecret();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE", () -> TEMP.resolve("bootstrap.secret").toString());
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:password-" + TEMP.getFileName() + ";DB_CLOSE_DELAY=-1");
        registry.add("logging.file.name", () -> TEMP.resolve("test.log").toString());
        registry.add("sc.framework.file-storage.root", () -> TEMP.resolve("uploads").toString());
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired UserService service;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    private UserEntity owner;

    @BeforeEach void prepare() {
        jdbc.update("DELETE FROM security_audit_event");
        jdbc.update("DELETE FROM reference_user WHERE username = ?", "password-owner");
        owner = users.saveAndFlush(new UserEntity("password-owner", "합성 계정", encoder.encode(OLD), "REQUESTER", Instant.now()));
    }

    @Test void commitChangesOnlyOwnHashInvalidatesCurrentSessionAndRequiresNewPassword() throws Exception {
        Session session = login(OLD);
        String originalHash = owner.getPasswordHash();
        mvc.perform(post("/api/auth/password").session(session.session()).header(session.header(), session.token())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("currentPassword", OLD, "newPassword", NEW))))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(session.session().isInvalid()).isTrue();
        String changed = users.findById(owner.getId()).orElseThrow().getPasswordHash();
        assertThat(changed.equals(originalHash)).isFalse();
        assertThat(encoder.matches(NEW, changed)).isTrue();
        assertThat(encoder.matches(OLD, changed)).isFalse();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        Session replacement = login(NEW);
        mvc.perform(get("/api/auth/me").session(replacement.session())).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(owner.getId())).andExpect(jsonPath("$.passwordHash").doesNotExist());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE action='PASSWORD_CHANGE' AND outcome='SUCCESS' AND actor_id=?", Integer.class, owner.getId())).isEqualTo(1);
    }

    @Test void wrongCurrentPasswordInvalidLengthUtf8AndCsrfPreserveHashAndSession() throws Exception {
        Session session = login(OLD);
        for (Map<String,String> input : List.of(
                Map.of("currentPassword", "synthetic-wrong-password", "newPassword", NEW),
                Map.of("currentPassword", OLD, "newPassword", "short"),
                Map.of("currentPassword", OLD, "newPassword", "가".repeat(25)))) {
            var result = mvc.perform(post("/api/auth/password").session(session.session()).header(session.header(), session.token())
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                    .andExpect(status().isBadRequest()).andReturn();
            assertThat(result.getResponse().getContentAsString().contains(input.get("newPassword"))).isFalse();
        }
        mvc.perform(post("/api/auth/password").session(session.session()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("currentPassword", OLD, "newPassword", NEW))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF"));
        assertThat(session.session().isInvalid()).isFalse();
        assertThat(encoder.matches(OLD, users.findById(owner.getId()).orElseThrow().getPasswordHash())).isTrue();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE action='PASSWORD_CHANGE' AND outcome='SUCCESS'", Integer.class)).isZero();
    }

    @Test void outerRollbackDoesNotCommitHashOrPublishFalseSuccess() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            service.changePassword(new UserDtos.PasswordInput(OLD, NEW), owner);
            status.setRollbackOnly();
        });
        assertThat(encoder.matches(OLD, users.findById(owner.getId()).orElseThrow().getPasswordHash())).isTrue();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE action='PASSWORD_CHANGE' AND outcome='SUCCESS'", Integer.class)).isZero();
    }

    private Session login(String password) throws Exception {
        var initial = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        JsonNode before = json.readTree(initial.getResponse().getContentAsString());
        var loggedIn = mvc.perform(post("/api/auth/login").session((MockHttpSession) initial.getRequest().getSession(false))
                .header(before.get("headerName").asText(), before.get("token").asText()).param("username", "password-owner").param("password", password))
                .andExpect(status().isNoContent()).andReturn();
        var session = (MockHttpSession) loggedIn.getRequest().getSession(false);
        JsonNode csrf = json.readTree(mvc.perform(get("/api/auth/csrf").session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        return new Session(session, csrf.get("headerName").asText(), csrf.get("token").asText());
    }
    private record Session(MockHttpSession session, String header, String token) {}
    private static Path temporarySecret() {
        try {
            Path folder = Files.createTempDirectory("sc-password-010-");
            Path secret = folder.resolve("bootstrap.secret"); Files.writeString(secret, OLD);
            if (Files.getFileStore(secret).supportsFileAttributeView("posix")) Files.setPosixFilePermissions(secret, PosixFilePermissions.fromString("rw-------"));
            return folder;
        } catch (IOException error) { throw new IllegalStateException("Could not prepare synthetic fixture"); }
    }
    @AfterAll static void cleanup() throws IOException {
        try (var paths = Files.walk(TEMP)) { for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path); }
    }
}
