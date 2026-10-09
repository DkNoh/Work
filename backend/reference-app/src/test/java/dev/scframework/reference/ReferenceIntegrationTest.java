package dev.scframework.reference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import dev.scframework.autoconfigure.integration.FeignCallBoundary;
import dev.scframework.core.ApiException;
import dev.scframework.reference.example.ExampleReadMapper;
import dev.scframework.reference.example.ExampleRepository;
import dev.scframework.reference.example.ExampleService;
import dev.scframework.reference.integration.ReferenceEchoClient;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.openfeign.FeignClientBuilder;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("dev")
@Execution(ExecutionMode.SAME_THREAD)
class ReferenceIntegrationTest {
    private static final String PASSWORD = "synthetic-test-password-only-001";
    private static final Path TEMP = createTemp();
    private static final String DATABASE_URL = "jdbc:h2:mem:reference-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
    private static final AtomicInteger ECHO_STATUS = new AtomicInteger(200);
    private static final AtomicInteger ECHO_REQUESTS = new AtomicInteger();
    private static final AtomicReference<String> ECHO_COOKIE = new AtomicReference<>();
    private static final AtomicReference<String> ECHO_AUTHORIZATION = new AtomicReference<>();
    private static final AtomicReference<String> ECHO_CSRF = new AtomicReference<>();
    private static final AtomicReference<String> ECHO_REQUEST_ID = new AtomicReference<>();
    private static final AtomicReference<String> ECHO_BODY = new AtomicReference<>("{\"message\":\"loopback\"}");
    private static final AtomicInteger ECHO_DELAY_MILLIS = new AtomicInteger();
    private static final AtomicReference<CountDownLatch> ECHO_COMPLETION = new AtomicReference<>();
    private static final String BODY_MARKER = "synthetic-upstream-body-canary-008";
    private static final String PASSWORD_MARKER = "synthetic-upstream-password-canary-008";
    private static final String TOKEN_MARKER = "synthetic-upstream-token-canary-008";
    private static final String INCOMING_AUTHORIZATION = "synthetic-incoming-authorization-008";
    private static final ExecutorService ECHO_EXECUTOR = Executors.newFixedThreadPool(2);
    private static final HttpServer ECHO = createEcho(0);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE", () -> TEMP.resolve("bootstrap.secret").toString());
        registry.add("SC_BOOTSTRAP_USERNAME", () -> "test-admin");
        registry.add("spring.datasource.url", () -> DATABASE_URL);
        registry.add("logging.file.name", () -> TEMP.resolve("reference-test.log").toString());
        registry.add("sc.reference.echo-url", () -> "http://127.0.0.1:" + ECHO.getAddress().getPort());
        // 실제 지연을 짧게 재현하되 운영의 default timeout 설정은 바꾸지 않는다.
        registry.add("spring.cloud.openfeign.client.config.referenceEcho.connectTimeout", () -> 200);
        registry.add("spring.cloud.openfeign.client.config.referenceEcho.readTimeout", () -> 200);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ExampleRepository repository;
    @Autowired ExampleReadMapper mapper;
    @Autowired ExampleService service;
    @Autowired DataSource dataSource;
    @Autowired SqlSessionFactory sessions;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired ApplicationContext applicationContext;
    @Autowired FeignCallBoundary feignBoundary;

    @BeforeEach
    void resetSyntheticData() {
        repository.deleteAll();
        ECHO_STATUS.set(200);
        ECHO_REQUESTS.set(0);
        ECHO_COOKIE.set(null);
        ECHO_AUTHORIZATION.set(null);
        ECHO_CSRF.set(null);
        ECHO_REQUEST_ID.set(null);
        ECHO_BODY.set("{\"message\":\"loopback\"}");
        ECHO_DELAY_MILLIS.set(0);
        ECHO_COMPLETION.set(null);
    }

    @Test
    void sessionLoginRequiresCsrfAndRenewedTokenProtectsWritesAndLogout() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.application").value("sc-reference-app"));
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
        Csrf beforeLogin = csrf(null);
        mvc.perform(post("/api/auth/login").session(beforeLogin.session())
                .param("username", "test-admin").param("password", PASSWORD)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF"));
        mvc.perform(post("/api/auth/login").session(beforeLogin.session()).header(beforeLogin.header(), beforeLogin.token())
                .param("username", "test-admin").param("password", "synthetic-wrong-password"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_FAILED"));
        MockHttpSession session = login(beforeLogin);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("test-admin")).andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.id").isNumber()).andExpect(jsonPath("$.displayName").value("관리자"))
                .andExpect(jsonPath("$.roles").doesNotExist()).andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(post("/api/examples").session(session).header(beforeLogin.header(), beforeLogin.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"stale csrf\"}"))
                .andExpect(status().isForbidden());
        Csrf afterLogin = csrf(session);
        mvc.perform(post("/api/auth/logout").session(session).header(afterLogin.header(), afterLogin.token()))
                .andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void typedCrudValidationTrimAndRevisionConflictKeepTheSavedRecord() throws Exception {
        Csrf csrf = csrf(login(csrf(null)));
        mvc.perform(post("/api/examples").session(csrf.session()).header(csrf.header(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"  \"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("title"));
        mvc.perform(post("/api/examples").session(csrf.session()).header(csrf.header(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"sample\",\"unknown\":true}"))
                .andExpect(status().isBadRequest());
        MvcResult created = mvc.perform(post("/api/examples").session(csrf.session()).header(csrf.header(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"  neutral sample  \"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("neutral sample"))
                .andExpect(jsonPath("$.revision").value(1)).andReturn();
        long id = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(put("/api/examples/" + id).session(csrf.session()).header(csrf.header(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"missing revision\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("revision"));
        mvc.perform(put("/api/examples/" + id).session(csrf.session()).header(csrf.header(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"renamed\",\"revision\":1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(2));
        mvc.perform(put("/api/examples/" + id).session(csrf.session()).header(csrf.header(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"stale edit\",\"revision\":1}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REVISION_CONFLICT"))
                .andExpect(jsonPath("$.errors").isEmpty());
        mvc.perform(get("/api/examples").session(csrf.session())).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("renamed")).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(20));
        mvc.perform(get("/api/examples").session(csrf.session()).param("size", "101"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("size"));
        mvc.perform(get("/api/examples/summary").session(csrf.session())).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void jpaFlushBecomesVisibleToMyBatisAndBothUseTheSameRollbackBoundary() {
        assertThat(transactionManager).isInstanceOf(JpaTransactionManager.class);
        assertThat(sessions.getConfiguration().getEnvironment().getDataSource()).isSameAs(dataSource);
        var original = service.create("before flush");
        var transaction = new TransactionTemplate(transactionManager);
        assertThatThrownBy(() -> transaction.execute(status -> {
            var entry = repository.findById(original.id()).orElseThrow();
            entry.rename("after flush");
            assertThat(mapper.findTitle(original.id())).isEqualTo("before flush");
            repository.flush();
            assertThat(mapper.findTitle(original.id())).isEqualTo("after flush");
            assertThat(entry.getRevision()).isEqualTo(2);
            throw new SyntheticRollback();
        })).isInstanceOf(SyntheticRollback.class);
        assertThat(mapper.findTitle(original.id())).isEqualTo("before flush");
        assertThat(repository.findById(original.id()).orElseThrow().getRevision()).isEqualTo(1);
    }

    @Test
    void feignUsesLoopbackTimeoutConfigurationWithoutForwardingSessionCredentialsOrRetryingFailures() throws Exception {
        Csrf csrf = csrf(login(csrf(null)));
        mvc.perform(get("/api/integration/echo").session(csrf.session()).header("X-Request-ID", "test-feign-001")
                .header("Cookie", "JSESSIONID=synthetic-incoming-cookie").header("X-CSRF-TOKEN", "synthetic-incoming-token")
                .header("Authorization", "Bearer " + INCOMING_AUTHORIZATION))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("loopback"));
        assertThat(ECHO_COOKIE.get()).isNull();
        assertThat(ECHO_AUTHORIZATION.get()).isNull();
        assertThat(ECHO_CSRF.get()).isNull();
        assertThat(ECHO_REQUEST_ID.get()).isEqualTo("test-feign-001");
        ECHO_STATUS.set(503);
        ECHO_REQUESTS.set(0);
        mvc.perform(get("/api/integration/echo").session(csrf.session())).andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("UPSTREAM_FAILURE"));
        assertThat(ECHO_REQUESTS.get()).isEqualTo(1);
    }

    @Test
    void upstreamHttpStatusesStayBounded502WithoutForwardingSensitiveHeadersOrRetrying() throws Exception {
        Csrf csrf = csrf(login(csrf(null)));
        ECHO_BODY.set("{\"body\":\"" + BODY_MARKER + "\",\"password\":\"" + PASSWORD_MARKER
                + "\",\"token\":\"" + TOKEN_MARKER + "\"}");
        for (int upstreamStatus : List.of(401, 403, 404, 429, 503)) {
            ECHO_STATUS.set(upstreamStatus);
            ECHO_REQUESTS.set(0);
            String requestId = "test-feign-status-" + upstreamStatus;
            MvcResult result = mvc.perform(get("/api/integration/echo").session(csrf.session())
                    .header("X-Request-ID", requestId).header("Cookie", "JSESSIONID=synthetic-incoming-cookie")
                    .header("Authorization", "Bearer " + INCOMING_AUTHORIZATION)
                    .header("X-CSRF-TOKEN", "synthetic-incoming-token"))
                    .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("UPSTREAM_FAILURE"))
                    .andExpect(jsonPath("$.errors").isEmpty()).andReturn();
            assertSafeUpstreamFailure(result);
            assertThat(ECHO_REQUESTS.get()).as("HTTP %s is never retried", upstreamStatus).isEqualTo(1);
            assertThat(ECHO_COOKIE.get()).isNull();
            assertThat(ECHO_AUTHORIZATION.get()).isNull();
            assertThat(ECHO_CSRF.get()).isNull();
            assertThat(ECHO_REQUEST_ID.get()).isEqualTo(requestId);
        }
    }

    @Test
    void malformedUpstreamJsonIsBounded502AndDecoderBodyNeverLeaks() throws Exception {
        Csrf csrf = csrf(login(csrf(null)));
        ECHO_BODY.set("{\"message\":\"" + BODY_MARKER + "\",\"password\":\"" + PASSWORD_MARKER
                + "\",\"token\":\"" + TOKEN_MARKER);
        MvcResult result = mvc.perform(get("/api/integration/echo").session(csrf.session()))
                .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("UPSTREAM_FAILURE"))
                .andExpect(jsonPath("$.errors").isEmpty()).andReturn();
        assertSafeUpstreamFailure(result);
        assertThat(ECHO_REQUESTS.get()).isEqualTo(1);
    }

    @Test
    void structurallyInvalidSuccessResponsesAndNoContentAreBounded502WithoutRetries() throws Exception {
        Csrf csrf = csrf(login(csrf(null)));
        List<String> bodies = List.of("{}", "{\"message\":null}", "{\"message\":\"  \"}", "");
        try {
            for (int index = 0; index < bodies.size(); index++) {
                int upstreamStatus = index == 3 ? 204 : 200;
                ECHO_STATUS.set(upstreamStatus);
                ECHO_BODY.set(bodies.get(index));
                ECHO_REQUESTS.set(0);
                MvcResult result = mvc.perform(get("/api/integration/echo").session(csrf.session())
                        .header("Authorization", "Bearer " + INCOMING_AUTHORIZATION))
                        .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("UPSTREAM_FAILURE"))
                        .andExpect(jsonPath("$.message").value("외부 서비스 응답이 올바르지 않습니다."))
                        .andExpect(jsonPath("$.errors").isEmpty()).andReturn();
                assertSafeUpstreamFailure(result);
                assertThat(ECHO_REQUESTS.get()).as("invalid success response %s is never retried", index).isEqualTo(1);
                assertThat(ECHO_AUTHORIZATION.get()).isNull();
            }
        } finally {
            ECHO_STATUS.set(200);
            ECHO_BODY.set("{\"message\":\"loopback\"}");
        }
    }

    @Test
    void actualReadTimeoutIs504AndOneRequestCompletesWithoutAutomaticRetry() throws Exception {
        Csrf csrf = csrf(login(csrf(null)));
        ECHO_DELAY_MILLIS.set(1200);
        ECHO_BODY.set("{\"message\":\"" + BODY_MARKER + "\",\"token\":\"" + TOKEN_MARKER + "\"}");
        try {
            MvcResult result = mvc.perform(get("/api/integration/echo").session(csrf.session())
                    .header("X-Request-ID", "test-feign-timeout-008"))
                    .andExpect(status().isGatewayTimeout()).andExpect(jsonPath("$.code").value("UPSTREAM_TIMEOUT"))
                    .andExpect(jsonPath("$.errors").isEmpty()).andReturn();
            assertSafeUpstreamFailure(result);
            assertThat(ECHO_REQUESTS.get()).isEqualTo(1);
            assertThat(ECHO_REQUEST_ID.get()).isEqualTo("test-feign-timeout-008");
            CountDownLatch completed = ECHO_COMPLETION.get();
            assertThat(completed).isNotNull();
            // mock의 지연 작업까지 끝난 후 count=1을 확인해 늦은 retry도 검사한다.
            assertThat(completed.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(ECHO_REQUESTS.get()).isEqualTo(1);
        } finally {
            ECHO_DELAY_MILLIS.set(0);
        }
    }

    @Test
    void refusedSeparateLoopbackTargetIs504WithoutStoppingTheSharedFixtureListener() throws Exception {
        int closedPort;
        try (ServerSocket reserved = new ServerSocket()) {
            reserved.bind(new InetSocketAddress("127.0.0.1", 0));
            closedPort = reserved.getLocalPort();
        }
        // 같은 Cloud client 이름의 options/retry/interceptor를 소비하되 target만 별도로 만든다.
        ReferenceEchoClient refused = new FeignClientBuilder(applicationContext)
                .forType(ReferenceEchoClient.class, "referenceEcho")
                .url("http://127.0.0.1:" + closedPort).build();
        assertThatThrownBy(() -> feignBoundary.call(refused::echo))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status()).isEqualTo(504);
                    assertThat(error.error().code()).isEqualTo("UPSTREAM_TIMEOUT");
                    assertThat(error.error().errors()).isEmpty();
                    assertThat(error.getCause()).isNull();
                    assertThat(error.getMessage()).doesNotContain("127.0.0.1", Integer.toString(closedPort),
                            BODY_MARKER, PASSWORD_MARKER, TOKEN_MARKER);
                });
        assertThat(ECHO_REQUESTS.get()).isZero();
        Csrf csrf = csrf(login(csrf(null)));
        mvc.perform(get("/api/integration/echo").session(csrf.session()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("loopback"));
        assertThat(ECHO_REQUESTS.get()).isEqualTo(1);
    }

    private void assertSafeUpstreamFailure(MvcResult result) throws IOException {
        String response = result.getResponse().getContentAsString();
        assertThat(response).doesNotContain(BODY_MARKER, PASSWORD_MARKER, TOKEN_MARKER, INCOMING_AUTHORIZATION);
        JsonNode value = json.readTree(response);
        assertThat(value.size()).isEqualTo(3);
        assertThat(value.has("code") && value.has("message") && value.has("errors")).isTrue();
        Path log = TEMP.resolve("reference-test.log");
        if (Files.exists(log)) {
            assertThat(Files.readString(log)).doesNotContain(BODY_MARKER, PASSWORD_MARKER, TOKEN_MARKER, INCOMING_AUTHORIZATION);
        }
    }

    @Test
    void devSwaggerContainsFilterLoginTypedErrorsAndJsonCsrfInterceptor() throws Exception {
        JsonNode specification = json.readTree(mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(specification.at("/paths/~1api~1auth~1login/post/requestBody/content/application~1x-www-form-urlencoded/schema/properties/username").isMissingNode()).isFalse();
        assertThat(specification.at("/paths/~1api~1auth~1login/post/responses/204").isMissingNode()).isFalse();
        assertThat(specification.at("/components/schemas/ApiError/properties/errors").isMissingNode()).isFalse();
        assertThat(specification.at("/components/schemas/FieldViolation/properties/field").isMissingNode()).isFalse();
        assertThat(specification.at("/components/schemas/ExampleDto/required").toString()).contains("id", "title", "revision");
        assertThat(specification.at("/components/schemas/ExamplePage/required").toString()).contains("items", "total", "page", "size");
        assertThat(specification.at("/components/schemas/UserResponse/required").toString()).contains("id", "username", "displayName", "role");
        for (String schema : java.util.List.of("RequirementSummary", "RequirementDetail")) {
            JsonNode flag = specification.at("/components/schemas/" + schema + "/properties/similar");
            assertThat(flag.get("type").asText()).isEqualTo("integer");
            assertThat(flag.get("enum").get(0).isIntegralNumber()).isTrue();
            assertThat(flag.get("enum").get(0).asInt()).isZero();
            assertThat(flag.get("enum").get(1).asInt()).isEqualTo(1);
        }
        JsonNode active = specification.at("/components/schemas/MenuResponse/properties/active/enum");
        assertThat(active.get(0).isIntegralNumber()).isTrue(); assertThat(active.get(1).isIntegralNumber()).isTrue();
        for (String field : java.util.List.of("annotation", "screenVersion", "review", "ado")) {
            JsonNode property = specification.at("/components/schemas/RequirementDetail/properties/" + field);
            assertThat(property.has("$ref")).isFalse(); assertThat(property.has("type")).isFalse();
            assertThat(property.at("/anyOf/0/$ref").asText()).startsWith("#/components/schemas/");
            assertThat(property.at("/anyOf/1/type").asText()).isEqualTo("null");
        }
        assertThat(specification.at("/components/schemas/RequirementInput/properties/annotation/anyOf/1/type").asText()).isEqualTo("null");
        assertThat(specification.at("/components/schemas/RequirementDetail/required").toString()).contains("annotation", "review", "screenVersion", "ado");
        assertThat(specification.at("/components/schemas/UpdateExample/required").toString()).contains("title", "revision");
        assertThat(specification.at("/paths/~1api~1auth~1csrf/get/security").isArray()).isTrue();
        assertThat(specification.at("/paths/~1api~1auth~1csrf/get/security").isEmpty()).isTrue();
        assertThat(specification.at("/paths/~1api~1examples/put").isMissingNode()).isTrue();
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
        String initializer = mvc.perform(get("/swagger-ui/swagger-initializer.js")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(initializer).contains("requestInterceptor", "fetch('/api/auth/csrf'", "csrf.headerName", "same-origin");
    }

    private Csrf csrf(MockHttpSession session) throws Exception {
        var request = get("/api/auth/csrf");
        if (session != null) request.session(session);
        MvcResult result = mvc.perform(request).andExpect(status().isOk()).andReturn();
        JsonNode value = json.readTree(result.getResponse().getContentAsString());
        return new Csrf((MockHttpSession) result.getRequest().getSession(false), value.get("headerName").asText(), value.get("token").asText());
    }

    private MockHttpSession login(Csrf csrf) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").session(csrf.session()).header(csrf.header(), csrf.token())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED).param("username", "test-admin").param("password", PASSWORD))
                .andExpect(status().isNoContent()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private record Csrf(MockHttpSession session, String header, String token) {}
    private static final class SyntheticRollback extends RuntimeException {}

    private static Path createTemp() {
        try {
            Path temp = Files.createTempDirectory("sc-reference-test-");
            Path secret = Files.writeString(temp.resolve("bootstrap.secret"), PASSWORD);
            if (Files.getFileStore(secret).supportsFileAttributeView("posix")) Files.setPosixFilePermissions(secret, PosixFilePermissions.fromString("rw-------"));
            return temp;
        } catch (IOException exception) { throw new IllegalStateException("Could not create isolated test files", exception); }
    }

    private static HttpServer createEcho(int port) {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
            server.setExecutor(ECHO_EXECUTOR);
            server.createContext("/echo", exchange -> {
                CountDownLatch completed = new CountDownLatch(1);
                ECHO_COMPLETION.set(completed);
                ECHO_REQUESTS.incrementAndGet();
                ECHO_COOKIE.set(exchange.getRequestHeaders().getFirst("Cookie"));
                ECHO_AUTHORIZATION.set(exchange.getRequestHeaders().getFirst("Authorization"));
                ECHO_CSRF.set(exchange.getRequestHeaders().getFirst("X-CSRF-TOKEN"));
                ECHO_REQUEST_ID.set(exchange.getRequestHeaders().getFirst("X-Request-ID"));
                int responseStatus = ECHO_STATUS.get();
                byte[] body = ECHO_BODY.get().getBytes(StandardCharsets.UTF_8);
                try {
                    int delay = ECHO_DELAY_MILLIS.get();
                    if (delay > 0) Thread.sleep(delay);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(responseStatus, responseStatus == 204 ? -1 : body.length);
                    if (responseStatus != 204) {
                        try (var output = exchange.getResponseBody()) { output.write(body); }
                    }
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                } catch (IOException clientClosedAfterTimeout) {
                    // 실제 timeout/refused fixture는 닫힌 socket에 응답할 수 있다. 본문을 로그에 쓰지 않는다.
                } finally {
                    exchange.close();
                    completed.countDown();
                }
            });
            server.start();
            return server;
        } catch (IOException exception) { throw new IllegalStateException("Could not start loopback fixture", exception); }
    }

    @AfterAll
    static void cleanup() throws IOException, InterruptedException {
        ECHO.stop(0);
        ECHO_EXECUTOR.shutdownNow();
        try {
            assertThat(ECHO_EXECUTOR.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        } finally {
            try (var files = Files.walk(TEMP)) {
                for (Path path : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }
}
