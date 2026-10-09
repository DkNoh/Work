package dev.scframework.reference.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.autoconfigure.audit.AuditWriteDiagnostics;
import dev.scframework.core.audit.SecurityAuditSink;
import dev.scframework.reference.identity.UserRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Comparator;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** 실제 업무 HTTP/commit 이후의 sink 실패가 잘못된500·재시도 저장으로 바뀌지 않는지 확인한다. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
class AuditSinkFailureHttpTest {
    private static final String PASSWORD = "synthetic-audit-http-password";
    private static final String CANARY = "synthetic-private-sink-exception";
    private static final Path TEMP = createTemp();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE", () -> TEMP.resolve("bootstrap.secret").toString());
        registry.add("SC_BOOTSTRAP_USERNAME", () -> "audit-http-admin");
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:audit-http-" + TEMP.getFileName() + ";DB_CLOSE_DELAY=-1");
        registry.add("logging.file.name", () -> TEMP.resolve("test.log").toString());
    }
    @MockitoBean SecurityAuditSink sink;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired AuditWriteDiagnostics diagnostics;

    @Test @WithMockUser(username = "audit-http-admin", roles = "ADMIN")
    void committedUserCreationStillReturns200AndSignalsMissingAuditWithoutPrivateLog() throws Exception {
        doThrow(new IllegalStateException(CANARY)).when(sink).save(any());
        long before = diagnostics.getFailedWrites();
        var response = mvc.perform(post("/api/users").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "committed-user", "displayName", "합성 사용자", "password", PASSWORD, "role", "REQUESTER"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.username").value("committed-user"))
                .andExpect(jsonPath("$.password").doesNotExist()).andExpect(jsonPath("$.passwordHash").doesNotExist()).andReturn();
        assertThat(users.findByUsername("committed-user").isPresent()).isTrue();
        assertThat(diagnostics.getFailedWrites() - before).isEqualTo(1);
        assertThat(response.getResponse().getContentAsString().contains(CANARY)).isFalse();
        if (Files.exists(TEMP.resolve("test.log"))) {
            String log = Files.readString(TEMP.resolve("test.log"));
            assertThat(log.contains(CANARY) || log.contains(PASSWORD)).isFalse();
            assertThat(log.contains("reasonCode=AUDIT_SINK_FAILURE")).isTrue();
        }
    }
    private static Path createTemp() {
        try {
            Path directory = Files.createTempDirectory("sc-audit-http-");
            Path secret = Files.writeString(directory.resolve("bootstrap.secret"), PASSWORD);
            if (Files.getFileStore(secret).supportsFileAttributeView("posix")) Files.setPosixFilePermissions(secret, PosixFilePermissions.fromString("rw-------"));
            return directory;
        } catch (IOException exception) { throw new IllegalStateException("Could not create isolated audit HTTP fixture"); }
    }
    @AfterAll static void cleanup() throws IOException {
        try (var files = Files.walk(TEMP)) {
            for (var file : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
        }
    }
}
