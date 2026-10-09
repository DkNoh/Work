package dev.scframework.starter;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.autoconfigure.browsererrors.BrowserErrorService;
import dev.scframework.autoconfigure.scheduling.OperationalSchedulerService;
import dev.scframework.autoconfigure.scheduling.ScSchedulerProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.Comparator;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.quartz.Scheduler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest @AutoConfigureMockMvc(print=MockMvcPrint.NONE) @ActiveProfiles("dev")
class StarterOperationsIntegrationTest {
    private static final Path TEMP=fixture();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry){
        registry.add("SC_BOOTSTRAP_SECRET_FILE",()->TEMP.resolve("bootstrap.secret").toString());registry.add("SC_BOOTSTRAP_USERNAME",()->"starter-ops-admin");
        registry.add("spring.datasource.url",()->"jdbc:h2:mem:starter-ops-"+TEMP.getFileName()+";DB_CLOSE_DELAY=-1");
        registry.add("spring.flyway.enabled",()->true);registry.add("spring.flyway.locations",()->"classpath:db/audit-migration,classpath:db/operations-migration");
        registry.add("sc.framework.audit.enabled",()->true);registry.add("sc.framework.messaging.enabled",()->false);
        registry.add("sc.framework.scheduler.enabled",()->true);registry.add("sc.framework.scheduler.bootstrap-defaults",()->false);
        registry.add("spring.quartz.job-store-type",()->"jdbc");registry.add("spring.quartz.jdbc.initialize-schema",()->"never");registry.add("spring.quartz.auto-startup",()->false);
        registry.add("spring.quartz.scheduler-name",()->"sc-starter-test-"+TEMP.getFileName());registry.add("spring.quartz.properties.org.quartz.jobStore.useProperties",()->true);
        registry.add("spring.quartz.properties.org.quartz.threadPool.threadCount",()->2);
        registry.add("sc.framework.browser-errors.enabled",()->true);registry.add("logging.file.name",()->TEMP.resolve("test.log").toString());
    }
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired OperationalSchedulerService schedulerService;@Autowired BrowserErrorService browsers;
    @Autowired DataSource source;@Autowired Scheduler scheduler;@Autowired ScSchedulerProperties properties;
    private JdbcTemplate jdbc;
    @BeforeEach void reset()throws Exception{scheduler.standby();scheduler.clear();jdbc=new JdbcTemplate(source);jdbc.update("DELETE FROM operation_job_run");jdbc.update("DELETE FROM operation_pulse_effect");jdbc.update("DELETE FROM operation_schedule");jdbc.update("DELETE FROM browser_error_occurrence");jdbc.update("DELETE FROM browser_error_receipt");jdbc.update("DELETE FROM browser_error_group");properties.setBootstrapDefaults(false);}
    @Test @WithMockUser(username="starter-ops-admin",roles="ADMIN")
    void starterKeepsDefaultIdentityAndNoReferenceBusinessTables()throws Exception{
        mvc.perform(get("/api/auth/me")).andExpect(status().isOk()).andExpect(jsonPath("$.username").value("starter-ops-admin")).andExpect(jsonPath("$.roles[0]").value("ADMIN")).andExpect(jsonPath("$.id").doesNotExist());
        mvc.perform(get("/api/operations/jobs/registered")).andExpect(status().isOk()).andExpect(jsonPath("$.items[?(@.jobCode=='PULSE')].executionMode").value(org.hamcrest.Matchers.hasItem("TRANSACTIONAL")));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME IN('REFERENCE_USER','REQUIREMENT','KANBAN_TASK','REFERENCE_DOCUMENT','STORED_FILE')",Integer.class)).isZero();
    }
    @Test @WithMockUser(username="starter-ops-admin",roles="ADMIN")
    void neutralPulseAndNullableActorReportPersistWithoutDomainAdapters()throws Exception{
        var created=schedulerService.create(new OperationalSchedulerService.Input("PULSE","0 0 0 1 1 ? 2099","UTC","SKIP",true),"starter-ops-admin");
        schedulerService.execute("PULSE",created.id(),Instant.parse("2026-10-07T00:00:00Z"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_pulse_effect",Long.class)).isEqualTo(1);
        String body="{\"schemaVersion\":1,\"clientEventId\":\""+UUID.randomUUID()+"\",\"source\":\"WINDOW\",\"eventCode\":\"WINDOW_ERROR\",\"appVersion\":\"0.1.0\",\"routeCode\":\"examples\",\"componentCode\":\"ROOT\"}";
        mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(body)).andExpect(status().isAccepted());
        var row=browsers.groups(0,20,null,null).items().getFirst();assertThat(browsers.occurrences(row.id(),0,20).items().getFirst().actorId()).isNull();
        assertThat(browsers.occurrences(row.id(),0,20).items().getFirst().actorSubject()).isEqualTo("starter-ops-admin");
    }
    @Test @WithMockUser(username="non-provider-user",roles="ADMIN")
    void forgedSessionIsNotAProviderIdentity()throws Exception{mvc.perform(get("/api/operations/jobs/schedules")).andExpect(status().isUnauthorized());mvc.perform(get("/api/operations/browser-errors/groups")).andExpect(status().isUnauthorized());}
    @Test void bootstrapDoesNotOverwriteManualPauseAndUsesFixedSystemId(){
        properties.setBootstrapDefaults(true);schedulerService.bootstrapDefaults();
        var first=schedulerService.schedules(0,20).items();assertThat(first).hasSize(1);assertThat(first.getFirst().id()).isEqualTo(3);assertThat(first.getFirst().jobCode()).isEqualTo("SAFE_RETENTION");
        schedulerService.enabled(3,false,1);schedulerService.bootstrapDefaults();var retained=schedulerService.schedules(0,20).items().getFirst();assertThat(retained.enabled()).isFalse();assertThat(retained.revision()).isEqualTo(2);
    }
    @Test @WithMockUser(username="starter-ops-admin",roles="ADMIN")
    void liveMetadataPreservesNumericVersionAndRequiredNullableFields()throws Exception{
        var result=mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn();var schemas=json.readTree(result.getResponse().getContentAsString()).get("components").get("schemas");
        var input=schemas.get("BrowserErrorInput");assertThat(input.get("required").size()).isEqualTo(7);assertThat(input.get("properties").get("schemaVersion").get("type").asText()).isEqualTo("integer");
        assertThat(input.get("properties").get("schemaVersion").get("minimum").asInt()).isEqualTo(1);assertThat(input.get("properties").get("schemaVersion").get("maximum").asInt()).isEqualTo(1);
        assertThat(input.get("properties").get("schemaVersion").get("enum").get(0).isIntegralNumber()).isTrue();
        assertThat(input.get("properties").get("schemaVersion").get("enum").get(0).asInt()).isEqualTo(1);
        assertThat(schemas.get("OperationalScheduleResponse").get("required").size()).isEqualTo(10);assertThat(schemas.get("BrowserErrorOccurrenceResponse").get("required").size()).isEqualTo(6);
        assertThat(result.getResponse().getContentAsString()).doesNotContain("OPERATION_PRIVATE_CANARY");
    }
    // 합성 계정 fixture만 만든다. Windows에는 POSIX API를 호출하지 않으며 운영 ACL 검증을 뜻하지 않는다.
    private static Path fixture(){try{var directory=Files.createTempDirectory("sc-starter-operations-");var secret=Files.writeString(directory.resolve("bootstrap.secret"),"synthetic-starter-operations-secret");if(Files.getFileStore(secret).supportsFileAttributeView("posix"))Files.setPosixFilePermissions(secret,PosixFilePermissions.fromString("rw-------"));return directory;}catch(Exception failure){throw new IllegalStateException("Could not prepare isolated starter fixture");}}
    @AfterAll static void cleanup()throws Exception{try(var paths=Files.walk(TEMP)){for(var path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}}
}
