package __JAVA_PACKAGE__;
import __JAVA_PACKAGE__.notes.*;
import com.sun.net.httpserver.HttpServer;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:generated-__APP_NAME__;DB_CLOSE_DELAY=-1","spring.profiles.active=dev"})
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
class GeneratedAppIntegrationTest {
    static final Path TEMP;
    static final Path SECRET;
    static final HttpServer UPSTREAM;
    static final AtomicInteger CALLS=new AtomicInteger();
    static final AtomicInteger UPSTREAM_STATUS=new AtomicInteger(200);
    static {
        try {
            TEMP=Files.createTempDirectory("generated-starter-test-");SECRET=TEMP.resolve("bootstrap.secret");
            byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);
            Files.writeString(SECRET,Base64.getUrlEncoder().withoutPadding().encodeToString(bytes),StandardOpenOption.CREATE_NEW);
            Files.setPosixFilePermissions(SECRET,PosixFilePermissions.fromString("rw-------"));
            UPSTREAM=HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
            UPSTREAM.createContext("/health",exchange->{
                CALLS.incrementAndGet();byte[] body="{\"status\":\"UP\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type","application/json");
                exchange.sendResponseHeaders(UPSTREAM_STATUS.get(),body.length);
                try(var output=exchange.getResponseBody()){output.write(body);}exchange.close();
            });UPSTREAM.start();
        } catch(Exception exception) {throw new IllegalStateException("Synthetic fixture could not start");}
    }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE",()->SECRET.toString());
        registry.add("starter.sample-http-url",()->"http://127.0.0.1:"+UPSTREAM.getAddress().getPort());
        registry.add("logging.file.name",()->TEMP.resolve("app.log").toString());
    }
    @Autowired MockMvc mvc;@Autowired NoteRepository repository;@Autowired NoteService service;
    @Autowired PlatformTransactionManager transactions;
    @BeforeEach void clean() {repository.deleteAll();UPSTREAM_STATUS.set(200);CALLS.set(0);}
    @AfterAll static void stop() throws Exception {
        UPSTREAM.stop(0);try(var files=Files.walk(TEMP)){for(Path file:files.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);}
    }
    @Test void authenticationAndCsrfAreRequired() throws Exception {
        mvc.perform(get("/api/notes")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/notes").with(user("admin").roles("ADMIN")).contentType("application/json").content("{\"title\":\"protected\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/login").with(csrf()).param("username","admin").param("password",Files.readString(SECRET))).andExpect(status().isNoContent());
    }
    @Test @WithMockUser(username="admin",roles="ADMIN") void flushAggregateRevisionAndStaleInput() throws Exception {
        String response=mvc.perform(post("/api/notes").with(csrf()).contentType("application/json").content("{\"title\":\"first\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.item.revision").value(1)).andExpect(jsonPath("$.stats.total").value(1)).andReturn().getResponse().getContentAsString();
        long id=new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).path("item").path("id").asLong();
        mvc.perform(put("/api/notes/"+id).with(csrf()).contentType("application/json").content("{\"title\":\"updated\",\"revision\":1}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.item.revision").value(2)).andExpect(jsonPath("$.stats.highestRevision").value(2));
        mvc.perform(put("/api/notes/"+id).with(csrf()).contentType("application/json").content("{\"title\":\"stale draft\",\"revision\":1}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REVISION_CONFLICT"));
        assertThat(repository.findById(id).orElseThrow().getTitle()).isEqualTo("updated");
    }
    @Test @WithMockUser(username="admin",roles="ADMIN") void typedLiteralQueryAndOwnerVisibility() throws Exception {
        var actor=UsernamePasswordAuthenticationToken.authenticated("admin","",java.util.List.of());
        long id=service.create(actor,new NoteDtos.Create("literal_%!한글")).item().id();
        service.create(actor,new NoteDtos.Create("ordinary"));
        mvc.perform(get("/api/notes").param("q","_%!")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        mvc.perform(get("/api/notes").with(user("other").roles("ADMIN"))).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/notes/"+id).with(user("other").roles("ADMIN"))).andExpect(status().isNotFound());
        mvc.perform(get("/api/notes").param("size","0")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/notes").with(csrf()).contentType("application/json").content("{\"title\":\" \"}")) .andExpect(status().isBadRequest());
    }
    @Test void mixedRollbackDoesNotRetainJpaOrMybatisRows() {
        var actor=UsernamePasswordAuthenticationToken.authenticated("admin","",java.util.List.of());
        assertThatThrownBy(()->new TransactionTemplate(transactions).execute(status->{
            assertThat(service.create(actor,new NoteDtos.Create("rollback")).stats().total()).isEqualTo(1);
            throw new IllegalStateException("Synthetic rollback");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(service.stats(actor).total()).isZero();assertThat(repository.count()).isZero();
    }
    @Test @WithMockUser(username="admin",roles="ADMIN") void explicitLoopbackFeignAndSafeUpstreamFailure() throws Exception {
        mvc.perform(get("/api/integration/sample")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        assertThat(CALLS.get()).isEqualTo(1);UPSTREAM_STATUS.set(500);
        mvc.perform(get("/api/integration/sample")).andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("UPSTREAM_FAILURE"));
        assertThat(CALLS.get()).isEqualTo(2);
    }
}
