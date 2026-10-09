package dev.scframework.reference.operations;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.autoconfigure.browsererrors.BrowserErrorContracts.Input;
import dev.scframework.autoconfigure.browsererrors.BrowserErrorService;
import dev.scframework.reference.identity.UserEntity;
import dev.scframework.reference.identity.UserRepository;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest @AutoConfigureMockMvc(print=MockMvcPrint.NONE) @ActiveProfiles("dev")
@Import(OperationalTestSupport.Config.class)
class BrowserErrorsIntegrationTest {
    private static final Path TEMP=OperationalTestSupport.fixture();
    private static int minute;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry){OperationalTestSupport.properties(registry,TEMP,"ops-browser-","browser-admin");}
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired DataSource source;@Autowired BrowserErrorService service;
    @Autowired OperationalTestSupport.MutableClock clock;@Autowired UserRepository users;@Autowired PasswordEncoder encoder;@Autowired PlatformTransactionManager manager;
    private JdbcTemplate jdbc;private Long actorId;
    @BeforeEach void prepare(){
        jdbc=new JdbcTemplate(source);jdbc.update("DELETE FROM browser_error_occurrence");jdbc.update("DELETE FROM browser_error_receipt");jdbc.update("DELETE FROM browser_error_group");
        clock.set(Instant.parse("2026-10-07T00:00:00Z").plusSeconds(++minute*60L));
        actorId=users.findByUsername("browser-admin").orElseThrow().getId();
        if(users.findByUsername("browser-reader").isEmpty())users.saveAndFlush(new UserEntity("browser-reader","합성 요청자",encoder.encode(OperationalTestSupport.PASSWORD),"REQUESTER",clock.instant()));
    }
    private Input input(){return new Input(1,UUID.randomUUID().toString(),"VUE","VUE_ERROR","0.1.0","examples","ROOT");}
    private String body()throws Exception{return json.writeValueAsString(input());}
    @Test @WithMockUser(username="browser-reader",roles="REQUESTER")
    void authenticatedReportsAreAcceptedButOnlyCurrentAdminMayRead()throws Exception{
        mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(body())).andExpect(status().isAccepted()).andExpect(jsonPath("$.accepted").value(true));
        mvc.perform(get("/api/operations/browser-errors/groups")).andExpect(status().isForbidden());
        assertThat(service.groups(0,20,null,null).total()).isEqualTo(1);
        long id=service.groups(0,20,null,null).items().getFirst().id();
        assertThat(service.occurrences(id,0,20).items().getFirst().actorId()).isEqualTo(users.findByUsername("browser-reader").orElseThrow().getId());
    }
    @Test void anonymousAndCsrfFailuresDoNotStoreReports()throws Exception{
        mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(body())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/operations/browser-errors").contentType("application/json").content(body())).andExpect(status().isForbidden());
        assertThat(service.groups(0,20,null,null).total()).isZero();
    }
    @Test @WithMockUser(username="browser-admin",roles="ADMIN")
    void unknownKeysAndWrongSchemaRegistryOrTypesAreRejectedWithoutRawCanary()throws Exception{
        String valid=body();
        for(String bad:new String[]{valid.replace("\"schemaVersion\":1","\"schemaVersion\":1.5"),valid.replace("\"0.1.0\"","\"0.3.0\""),valid.replace("\"examples\"","\"/requests/42?password=PRIVATE_CANARY\""),valid.replace("\"ROOT\"","\"PRIVATE_CANARY\""),valid.replace("\"VUE_ERROR\"","\"UNHANDLED_REJECTION\""),valid.substring(0,valid.length()-1)+",\"message\":\"PRIVATE_CANARY\"}",valid.substring(0,valid.length()-1)+",\"schemaVersion\":1}"}){
            var result=mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(bad)).andExpect(status().isBadRequest()).andReturn();
            assertThat(result.getResponse().getContentAsString()).doesNotContain("PRIVATE_CANARY");
        }
        mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(" ".repeat(4097))).andExpect(status().isPayloadTooLarge());
        mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("text/plain").content(valid)).andExpect(status().isUnsupportedMediaType());
        assertThat(service.groups(0,20,null,null).total()).isZero();
    }
    @Test @WithMockUser(username="browser-admin",roles="ADMIN")
    void duplicateReceiptCountsOnceAndSafeDtoRetainsUtcIdentityOnly()throws Exception{
        String report=body();
        for(int i=0;i<2;i++)mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(report).header("X-Request-ID","test-browser-request")).andExpect(status().isAccepted());
        var result=mvc.perform(get("/api/operations/browser-errors/groups").param("source","VUE").param("eventCode","VUE_ERROR")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].occurrenceCount").value(1)).andReturn();
        var group=json.readTree(result.getResponse().getContentAsString()).get("items").get(0);long id=group.get("id").asLong();
        assertThat(group.get("fingerprint").asText()).hasSize(64);assertThat(group.get("lastSeenAt").asText()).endsWith("Z");
        var occurrences=mvc.perform(get("/api/operations/browser-errors/groups/"+id+"/occurrences")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].actorId").value(actorId)).andExpect(jsonPath("$.items[0].requestId").value("test-browser-request")).andReturn();
        assertThat(occurrences.getResponse().getContentAsString()).doesNotContain("password","message","stack","cookie","token","query","OPERATION_PRIVATE_CANARY");
        String mutated=report.replace("\"VUE_ERROR\"","\"UNKNOWN_RUNTIME\"");mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(mutated)).andExpect(status().isBadRequest());
        assertThat(service.groups(0,20,null,null).items().getFirst().occurrenceCount()).isEqualTo(1);
    }
    @Test void concurrentDistinctEventsHaveOneFingerprintAndExactCount()throws Exception{
        try(var executor=Executors.newFixedThreadPool(8)){
            var calls=new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for(int index=0;index<16;index++)calls.add(executor.submit(()->service.accept(input(),actorId,"browser-admin","safe-request")));
            for(var call:calls)call.get(30,TimeUnit.SECONDS);
        }
        var groups=service.groups(0,20,null,null);assertThat(groups.total()).isEqualTo(1);assertThat(groups.items().getFirst().occurrenceCount()).isEqualTo(16);
        assertThat(service.occurrences(groups.items().getFirst().id(),0,100).total()).isEqualTo(16);
    }
    @Test void rollbackLeavesNoReceiptGroupOrOccurrence(){
        assertThatThrownBy(()->new TransactionTemplate(manager).executeWithoutResult(status->{service.accept(input(),actorId,"browser-admin","safe-request");throw new IllegalStateException("abort fixture");})).isInstanceOf(IllegalStateException.class);
        assertThat(service.groups(0,20,null,null).total()).isZero();assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM browser_error_receipt",Long.class)).isZero();
    }
    @Test @WithMockUser(username="browser-admin",roles="ADMIN")
    void actorRateReturns429RetryAfterAndClockAdvanceAllowsNextMinute()throws Exception{
        for(int index=0;index<20;index++)mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(body())).andExpect(status().isAccepted());
        mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(body())).andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After","60"));
        clock.set(clock.instant().plusSeconds(60));mvc.perform(post("/api/operations/browser-errors").with(csrf()).contentType("application/json").content(body())).andExpect(status().isAccepted());
        assertThat(service.groups(0,20,null,null).items().getFirst().occurrenceCount()).isEqualTo(21);
    }
    @Test void retentionDeletesOnlyOldOccurrencesReceiptsAndInactiveEmptyGroups(){
        service.accept(input(),actorId,"browser-admin","safe-request");long old=service.groups(0,20,null,null).items().getFirst().id();
        clock.set(clock.instant().plusSeconds(91L*86400));
        assertThat(service.retain()).isEqualTo(3);assertThat(service.groups(0,20,null,null).total()).isZero();
        service.accept(input(),actorId,"browser-admin","safe-request");assertThat(service.retain()).isZero();assertThat(service.groups(0,20,null,null).total()).isEqualTo(1);
    }
    @Test @WithMockUser(username="browser-reader",roles="ADMIN")
    void forgedOldAdminAuthorityCannotReadAndBoundsAreEnforced()throws Exception{
        mvc.perform(get("/api/operations/browser-errors/groups")).andExpect(status().isForbidden());
        assertThatThrownBy(()->service.groups(0,101,null,null)).isInstanceOf(dev.scframework.core.ApiException.class);
        assertThatThrownBy(()->service.groups(1_000_001,20,null,null)).isInstanceOf(dev.scframework.core.ApiException.class);
        assertThatThrownBy(()->service.groups(0,20,"PRIVATE_CANARY",null)).isInstanceOf(dev.scframework.core.ApiException.class);
    }
    @AfterAll static void cleanup()throws Exception{OperationalTestSupport.cleanup(TEMP);}
}
