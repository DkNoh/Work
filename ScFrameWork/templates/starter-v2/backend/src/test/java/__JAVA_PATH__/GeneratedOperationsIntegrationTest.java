package __JAVA_PACKAGE__;

import dev.scframework.autoconfigure.scheduling.OperationalSchedulerService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.Base64;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 빌드 테스트는 외부 broker/관측 secret 없이 선택 중립 JDBC 기능을 검증한다. */
@SpringBootTest(properties={"spring.profiles.active=dev"})
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
class GeneratedOperationsIntegrationTest {
    static final Path TEMP=fixture();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry){
        registry.add("SC_BOOTSTRAP_SECRET_FILE",()->TEMP.resolve("bootstrap.secret").toString());
        registry.add("spring.datasource.url",()->"jdbc:h2:mem:generated-operations-__APP_NAME__;DB_CLOSE_DELAY=-1");
        registry.add("spring.flyway.locations",()->"classpath:db/migration,classpath:db/audit-migration,classpath:db/operations-migration");
        registry.add("sc.framework.audit.enabled",()->true);registry.add("sc.framework.audit.durable-enabled",()->false);
        registry.add("sc.framework.messaging.enabled",()->false);registry.add("sc.framework.observability.enabled",()->false);
        registry.add("sc.framework.scheduler.enabled",()->true);registry.add("sc.framework.scheduler.bootstrap-defaults",()->false);
        registry.add("spring.quartz.job-store-type",()->"jdbc");registry.add("spring.quartz.jdbc.initialize-schema",()->"never");registry.add("spring.quartz.auto-startup",()->false);
        registry.add("spring.quartz.scheduler-name",()->"generated-__APP_NAME__-test");registry.add("spring.quartz.properties.org.quartz.jobStore.useProperties",()->true);
        registry.add("sc.framework.browser-errors.enabled",()->true);registry.add("sc.framework.browser-errors.app-version",()->"1.0.0");
        registry.add("sc.framework.browser-errors.route-codes",()->"login,notes,patterns,operations-messages,operations-schedules,operations-browser-errors");
        registry.add("logging.file.name",()->TEMP.resolve("app.log").toString());
    }
    @Autowired MockMvc mvc;@Autowired OperationalSchedulerService schedules;@Autowired Scheduler quartz;@Autowired DataSource source;
    JdbcTemplate jdbc;
    @BeforeEach void clean()throws Exception{quartz.standby();quartz.clear();jdbc=new JdbcTemplate(source);jdbc.update("DELETE FROM operation_job_run");jdbc.update("DELETE FROM operation_pulse_effect");jdbc.update("DELETE FROM operation_schedule");jdbc.update("DELETE FROM browser_error_occurrence");jdbc.update("DELETE FROM browser_error_receipt");jdbc.update("DELETE FROM browser_error_group");}
    @Test @WithMockUser(username="admin",roles="ADMIN") void selectedNeutralOperationsPreserveDefaultIdentity()throws Exception{
        mvc.perform(get("/api/auth/me")).andExpect(status().isOk()).andExpect(jsonPath("$.username").value("admin")).andExpect(jsonPath("$.roles[0]").value("ADMIN")).andExpect(jsonPath("$.id").doesNotExist());
        mvc.perform(get("/api/framework/capabilities")).andExpect(status().isOk()).andExpect(jsonPath("$.messaging").value(false)).andExpect(jsonPath("$.scheduler").value(true)).andExpect(jsonPath("$.browserErrors").value(true));
        mvc.perform(get("/api/operations/jobs/registered")).andExpect(status().isOk()).andExpect(jsonPath("$.items[?(@.jobCode=='PULSE')].executionMode").value(org.hamcrest.Matchers.hasItem("TRANSACTIONAL")));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME IN('REFERENCE_USER','REQUIREMENT_ENTRY','KANBAN_TASK')",Long.class)).isZero();
    }
    @Test void staleProviderSubjectAndTokenlessCommandsFailClosed()throws Exception{
        mvc.perform(get("/api/operations/jobs/schedules").with(user("missing-user").roles("ADMIN"))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/operations/jobs/schedules").with(user("admin").roles("ADMIN")).contentType("application/json").content("{}")).andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_schedule",Long.class)).isZero();
    }
    @Test void registeredPulseUsesTheConsumerMigrationAndCommittedHistory()throws Exception{
        var row=schedules.create(new OperationalSchedulerService.Input("PULSE","0 0 0 1 1 ? 2099","UTC","SKIP",true),"admin");
        Instant fire=Instant.parse("2026-10-07T00:00:00Z");schedules.execute("PULSE",row.id(),fire);schedules.execute("PULSE",row.id(),fire);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_pulse_effect",Long.class)).isEqualTo(1);
        assertThat(schedules.runs(0,20,row.id()).items()).hasSize(1).allMatch(run->run.state().equals("SUCCESS"));
    }
    @Test @WithMockUser(username="admin",roles="ADMIN") void browserCollectorAppVersionAndNotesRouteHaveTheirOwnContract()throws Exception{
        String input="{\"schemaVersion\":1,\"clientEventId\":\""+UUID.randomUUID()+"\",\"source\":\"VUE\",\"eventCode\":\"VUE_ERROR\",\"appVersion\":\"1.0.0\",\"routeCode\":\"notes\",\"componentCode\":\"ROOT\"}";
        mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(input.replace("1.0.0","0.1.0"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(input)).andExpect(status().isAccepted());
        assertThat(jdbc.queryForObject("SELECT SUM(occurrence_count) FROM browser_error_group",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_occurrence WHERE actor_id IS NOT NULL",Long.class)).isZero();
    }
    static Path fixture(){try{var root=Files.createTempDirectory("generated-operation-test-");byte[] random=new byte[32];new java.security.SecureRandom().nextBytes(random);var secret=Files.writeString(root.resolve("bootstrap.secret"),Base64.getUrlEncoder().withoutPadding().encodeToString(random));Files.setPosixFilePermissions(secret,PosixFilePermissions.fromString("rw-------"));return root;}catch(Exception error){throw new IllegalStateException("Synthetic operations fixture failed");}}
    @AfterAll static void stop()throws Exception{try(var paths=Files.walk(TEMP)){for(var file:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(file);}}
}
