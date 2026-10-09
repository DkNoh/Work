package dev.scframework.starter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.querydsl.jpa.impl.JPAQueryFactory;
import dev.scframework.autoconfigure.integration.FeignCallBoundary;
import dev.scframework.core.storage.FileStorage;
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
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
class StarterConsumerTest {
    private static final String PASSWORD = "synthetic-starter-password-only";
    private static final Path TEMP = createTemp();
    private static final String DATABASE_URL = "jdbc:h2:mem:starter-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE", () -> TEMP.resolve("bootstrap.secret").toString());
        registry.add("SC_BOOTSTRAP_USERNAME", () -> "starter-admin");
        registry.add("spring.datasource.url", () -> DATABASE_URL);
        registry.add("logging.file.name", () -> TEMP.resolve("starter-test.log").toString());
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired DataSource dataSource;
    @Autowired JPAQueryFactory queries;
    @Autowired FeignCallBoundary externalHttp;
    @Autowired org.springframework.context.ApplicationContext context;

    @Test
    void optionalQueryAndHttpPoliciesAreConsumedWithoutReferenceBusinessClasses() throws Exception {
        assertThat(queries).isNotNull();
        assertThat(externalHttp).isNotNull();
        for (String name : java.util.List.of("dev.scframework.reference.requirements.RequirementEntity",
                "dev.scframework.reference.requirements.RequirementReadMapperImpl")) {
            assertThatThrownBy(() -> Class.forName(name)).isInstanceOf(ClassNotFoundException.class);
        }
        try (var connection = dataSource.getConnection();
             var tables = connection.getMetaData().getTables(null, "PUBLIC", "REQUIREMENT_ENTRY", null)) {
            assertThat(tables.next()).isFalse();
        }
    }

    @Test void fileStorageAndDemoEndpointAreAbsentInDefaultStarter() throws Exception {
        assertThat(context.getBeansOfType(FileStorage.class)).isEmpty();
        var result=mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();var csrf=json.readTree(result.getResponse().getContentAsString());var session=(MockHttpSession)result.getRequest().getSession(false);
        mvc.perform(post("/api/auth/login").session(session).header(csrf.get("headerName").asText(),csrf.get("token").asText()).param("username","starter-admin").param("password",PASSWORD)).andExpect(status().isNoContent());
        mvc.perform(get("/api/storage-demo/unknown").session(session)).andExpect(status().isNotFound());
    }

    @Test
    void minimalAppConsumesSharedAuthHealthAndH2WithoutReferenceBusinessClasses() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.application").value("sc-starter-app"));
        var result = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        var csrf = json.readTree(result.getResponse().getContentAsString());
        var session = (MockHttpSession) result.getRequest().getSession(false);
        mvc.perform(post("/api/auth/login").session(session).header(csrf.get("headerName").asText(), csrf.get("token").asText())
                .param("username", "starter-admin").param("password", PASSWORD)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.username").value("starter-admin"));
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("H2");
            try (var tables = connection.getMetaData().getTables(null, "PUBLIC", "EXAMPLE_ENTRY", null)) {
                assertThat(tables.next()).isFalse();
            }
        }
        assertThatThrownBy(() -> Class.forName("dev.scframework.reference.example.ExampleEntry"))
                .isInstanceOf(ClassNotFoundException.class);
    }

    @Test
    void documentationIsDeniedWithoutTheDevProfile() throws Exception {
        // 익명 요청은 인증 진입점의 401, 로그인 후에는 명시적 denyAll의 403이다.
        mvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isUnauthorized());
        var result = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        var csrf = json.readTree(result.getResponse().getContentAsString());
        var session = (MockHttpSession) result.getRequest().getSession(false);
        mvc.perform(post("/api/auth/login").session(session).header(csrf.get("headerName").asText(), csrf.get("token").asText())
                .param("username", "starter-admin").param("password", PASSWORD)).andExpect(status().isNoContent());
        mvc.perform(get("/v3/api-docs").session(session)).andExpect(status().isForbidden());
        mvc.perform(get("/swagger-ui/index.html").session(session)).andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    private static Path createTemp() {
        try {
            Path directory = Files.createTempDirectory("sc-starter-test-");
            Path secret = Files.writeString(directory.resolve("bootstrap.secret"), PASSWORD);
            if (Files.getFileStore(secret).supportsFileAttributeView("posix")) Files.setPosixFilePermissions(secret, PosixFilePermissions.fromString("rw-------"));
            return directory;
        } catch (IOException exception) { throw new IllegalStateException("Could not create isolated fixture", exception); }
    }

    @AfterAll
    static void cleanup() throws IOException {
        try (var files = Files.walk(TEMP)) {
            for (var path : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }
}
