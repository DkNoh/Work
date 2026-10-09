package dev.scframework.reference.operations;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.autoconfigure.scheduling.*;
import dev.scframework.reference.identity.UserEntity;
import dev.scframework.reference.identity.UserRepository;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Date;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.quartz.*;
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
class OperationalSchedulerIntegrationTest {
    private static final Path TEMP=OperationalTestSupport.fixture();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry){OperationalTestSupport.properties(registry,TEMP,"ops-scheduler-","ops-admin");}
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired DataSource source;@Autowired Scheduler scheduler;
    @Autowired OperationalSchedulerService service;@Autowired OperationalTestSupport.MutableClock clock;
    @Autowired OperationalTestSupport.BlockingProbe probe;
    @Autowired UserRepository users;@Autowired PasswordEncoder encoder;@Autowired PlatformTransactionManager manager;
    private JdbcTemplate jdbc;
    @BeforeEach void prepare()throws Exception{
        scheduler.standby();scheduler.clear();probe.reset();jdbc=new JdbcTemplate(source);
        jdbc.update("DELETE FROM operation_job_run");jdbc.update("DELETE FROM operation_pulse_effect");jdbc.update("DELETE FROM operation_schedule");
        clock.set(Instant.parse("2026-10-07T00:00:00Z"));
        if(users.findByUsername("ops-reader").isEmpty())users.saveAndFlush(new UserEntity("ops-reader","합성 요청자",encoder.encode(OperationalTestSupport.PASSWORD),"REQUESTER",clock.instant()));
    }
    private OperationalSchedulerService.Input input(String code){return new OperationalSchedulerService.Input(code,"0 0 0 1 1 ? 2099","UTC","SKIP",true);}
    private String body(String code){return "{\"jobCode\":\""+code+"\",\"cron\":\"0 0 0 1 1 ? 2099\",\"timeZone\":\"UTC\",\"misfirePolicy\":\"SKIP\",\"enabled\":true}";}

    @Test @WithMockUser(username="ops-admin",roles="ADMIN")
    void httpCreatesUpdatesAndPausesWithRevisionWithoutOverwritingDraft()throws Exception{
        var response=mvc.perform(post("/api/operations/jobs/schedules").with(csrf()).contentType("application/json").content(body("PULSE"))).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1)).andReturn();
        long id=json.readTree(response.getResponse().getContentAsString()).get("id").asLong();assertThat(id).isGreaterThanOrEqualTo(100);
        mvc.perform(post("/api/operations/jobs/schedules/"+id+"/pause").with(csrf()).contentType("application/json").content("{\"revision\":1}")).andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false)).andExpect(jsonPath("$.revision").value(2)).andExpect(jsonPath("$.nextFireAt").doesNotExist());
        mvc.perform(post("/api/operations/jobs/schedules/"+id+"/resume").with(csrf()).contentType("application/json").content("{\"revision\":1}")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REVISION_CONFLICT"));
        mvc.perform(post("/api/operations/jobs/schedules/"+id+"/pause").with(csrf()).contentType("application/json").content("{\"revision\":2}")).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(2));
        mvc.perform(post("/api/operations/jobs/schedules/"+id+"/resume").with(csrf()).contentType("application/json").content("{\"revision\":2}")).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(3));
        mvc.perform(post("/api/operations/jobs/schedules").with(csrf()).contentType("application/json").content(body("PULSE"))).andExpect(status().isConflict());
        mvc.perform(get("/api/operations/jobs/registered")).andExpect(status().isOk()).andExpect(jsonPath("$.items[?(@.jobCode=='PULSE')].executionMode").value(org.hamcrest.Matchers.hasItem("TRANSACTIONAL")));
        mvc.perform(get("/api/operations/jobs/schedules").param("size","1")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get("/api/operations/jobs/schedules/"+id)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id)).andExpect(jsonPath("$.revision").value(3));
        mvc.perform(get("/api/operations/jobs/schedules/999999999")).andExpect(status().isNotFound());
    }
    @Test @WithMockUser(username="ops-reader",roles="ADMIN")
    void dbRoleBlocksStaleSessionAndCsrfStillApplies()throws Exception{
        mvc.perform(get("/api/operations/jobs/schedules")).andExpect(status().isForbidden());
        mvc.perform(post("/api/operations/jobs/schedules").with(csrf()).contentType("application/json").content(body("PULSE"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/operations/jobs/schedules").contentType("application/json").content(body("PULSE"))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_schedule",Long.class)).isZero();
    }
    @Test @WithMockUser(username="ops-admin",roles="ADMIN")
    void refusesSecondGranularityBadZoneUnregisteredJobsAndUnknownPayload()throws Exception{
        for(String bad:new String[]{body("PULSE").replace("0 0 0 1 1 ? 2099","* * * * * ?"),body("PULSE").replace("UTC","Not/AZone"),body("arbitrary.class"),body("PULSE").replace("SKIP","IGNORE_MISFIRES"),body("PULSE").replace("true}","true,\"class\":\"PRIVATE_CANARY\"}")}){
            var result=mvc.perform(post("/api/operations/jobs/schedules").with(csrf()).contentType("application/json").content(bad)).andExpect(status().isBadRequest()).andReturn();assertThat(result.getResponse().getContentAsString()).doesNotContain("PRIVATE_CANARY");
        }
        mvc.perform(get("/api/operations/jobs/schedules").param("size","101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/operations/jobs/runs").param("page","1000001")).andExpect(status().isBadRequest());
        var row=service.create(input("PULSE"),"ops-admin");
        for(String method:new String[]{"update","pause","resume"}){
            var request=method.equals("update")?put("/api/operations/jobs/schedules/"+row.id()):post("/api/operations/jobs/schedules/"+row.id()+"/"+method);
            mvc.perform(request.with(csrf()).contentType("application/json").content("null")).andExpect(status().isBadRequest());
        }
    }
    @Test void quartzAndAppRowsRollbackTogetherAndPayloadHasNoSerializedObjectHeader(){
        var tx=new TransactionTemplate(manager);
        assertThatThrownBy(()->tx.executeWithoutResult(status->{service.create(input("PULSE"),"ops-admin");throw new IllegalStateException("abort fixture");})).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_schedule",Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM QRTZ_JOB_DETAILS",Long.class)).isZero();
        var row=service.create(input("PULSE"),"ops-admin");
        byte[] data=jdbc.queryForObject("SELECT JOB_DATA FROM QRTZ_JOB_DETAILS WHERE JOB_NAME='PULSE'",byte[].class);
        assertThat(data).isNotNull();assertThat(data.length).isGreaterThan(2);assertThat(data[0]==(byte)0xac&&data[1]==(byte)0xed).isFalse();
        assertThat(new String(data,java.nio.charset.StandardCharsets.ISO_8859_1)).contains("jobCode=PULSE","scheduleId="+row.id());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM QRTZ_CALENDARS",Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM QRTZ_BLOB_TRIGGERS",Long.class)).isZero();
    }
    @Test void effectsAndSuccessHistoryCommitOnceAndFailureRollsBackItsEffect()throws Exception{
        var row=service.create(input("PULSE"),"ops-admin");Instant fire=clock.instant();service.execute("PULSE",row.id(),fire);service.execute("PULSE",row.id(),fire);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_pulse_effect",Long.class)).isEqualTo(1);
        assertThat(service.runs(0,20,row.id()).items()).hasSize(1).allMatch(run->run.state().equals("SUCCESS"));
        var fail=service.create(input("TEST_FAIL"),"ops-admin");
        assertThatThrownBy(()->service.execute("TEST_FAIL",fail.id(),fire)).hasMessage("Operational task failed");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_pulse_effect",Long.class)).isEqualTo(1);
        assertThat(service.runs(0,20,fail.id()).items()).hasSize(1).allMatch(run->run.state().equals("FAILED")&&"JOB_FAILED".equals(run.reasonCode()));
        assertThat(json.writeValueAsString(service.runs(0,20,null))).doesNotContain("OPERATION_PRIVATE_CANARY");
        var outside=service.create(input("TEST_OUTSIDE"),"ops-admin");new TransactionTemplate(manager).executeWithoutResult(status->{try{service.execute("TEST_OUTSIDE",outside.id(),fire);}catch(Exception failure){throw new AssertionError(failure);}});
        assertThat(service.runs(0,20,outside.id()).items()).hasSize(1).allMatch(run->run.state().equals("SUCCESS"));
    }
    @Test void onlyFinishedOldRunsAreRemovedInBoundedRetention()throws Exception{
        var row=service.create(input("PULSE"),"ops-admin");service.execute("PULSE",row.id(),clock.instant());
        jdbc.update("UPDATE operation_job_run SET completed_at=?",Instant.parse("2025-01-01T00:00:00Z").atOffset(java.time.ZoneOffset.UTC));
        assertThat(service.retainFinishedRuns()).isEqualTo(1);assertThat(service.runs(0,20,null).total()).isZero();
    }
    @Test void fastInternalSimpleTriggerMisfireFiresOnceAndDoesNotExposeFastCronApi()throws Exception{
        var row=service.create(input("PULSE"),"ops-admin");scheduler.unscheduleJob(OperationalSchedulerService.triggerKey(row.id()));
        scheduler.scheduleJob(TriggerBuilder.newTrigger().withIdentity("test-fire-once",OperationalSchedulerService.GROUP).forJob(OperationalSchedulerService.jobKey("PULSE")).startAt(Date.from(Instant.now().minusSeconds(5))).withSchedule(SimpleScheduleBuilder.simpleSchedule().withRepeatCount(0).withMisfireHandlingInstructionFireNow()).build());
        scheduler.start();long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(10);
        while(jdbc.queryForObject("SELECT COUNT(*) FROM operation_pulse_effect",Long.class)==0&&System.nanoTime()<end)TimeUnit.MILLISECONDS.sleep(25);
        scheduler.standby();assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_pulse_effect",Long.class)).isEqualTo(1);
        assertThat(service.runs(0,20,row.id()).items()).hasSize(1).allMatch(run->run.state().equals("SUCCESS"));
    }
    @Test void concurrentRevisionCommandsAcceptOnlyOneAndQuartzMatchesTheWinner()throws Exception{
        var row=service.create(input("PULSE"),"ops-admin");
        var barrier=new java.util.concurrent.CyclicBarrier(2);
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(2)){
            var results=new java.util.ArrayList<java.util.concurrent.Future<Integer>>();
            for(int hour=1;hour<=2;hour++){
                String cron="0 0 "+hour+" 1 1 ? 2099";
                results.add(executor.submit(()->{barrier.await(10,TimeUnit.SECONDS);try{service.update(row.id(),new OperationalSchedulerService.Input("PULSE",cron,"UTC","SKIP",true),1);return 200;}catch(dev.scframework.core.ApiException conflict){return conflict.status();}}));
            }
            assertThat(java.util.List.of(results.get(0).get(20,TimeUnit.SECONDS),results.get(1).get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        }
        var current=service.detail(row.id());assertThat(current.revision()).isEqualTo(2);
        var trigger=(CronTrigger)scheduler.getTrigger(OperationalSchedulerService.triggerKey(row.id()));
        assertThat(trigger.getCronExpression()).isEqualTo(current.cron());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_schedule",Long.class)).isEqualTo(1);
    }
    @Test void skipMisfireCompletesExpiredInternalTriggerWithoutExecutingTask()throws Exception{
        var row=service.create(input("PULSE"),"ops-admin");scheduler.unscheduleJob(OperationalSchedulerService.triggerKey(row.id()));
        var key=new TriggerKey("test-skip",OperationalSchedulerService.GROUP);
        scheduler.scheduleJob(TriggerBuilder.newTrigger().withIdentity(key).forJob(OperationalSchedulerService.jobKey("PULSE")).startAt(Date.from(Instant.now().minusSeconds(5))).withSchedule(SimpleScheduleBuilder.simpleSchedule().withRepeatCount(0).withMisfireHandlingInstructionNextWithRemainingCount()).build());
        scheduler.start();long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(10);
        while(scheduler.checkExists(key)&&System.nanoTime()<end)TimeUnit.MILLISECONDS.sleep(25);
        scheduler.standby();assertThat(scheduler.checkExists(key)).isFalse();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM operation_pulse_effect",Long.class)).isZero();
        assertThat(service.runs(0,20,row.id()).total()).isZero();
    }
    @Test void twoRealTriggersForOneJobKeyNeverOverlapTheirRegisteredTask()throws Exception{
        var row=service.create(input("TEST_BLOCK"),"ops-admin");scheduler.unscheduleJob(OperationalSchedulerService.triggerKey(row.id()));
        var first=new TriggerKey("test-block-first",OperationalSchedulerService.GROUP);
        var second=new TriggerKey("test-block-second",OperationalSchedulerService.GROUP);
        Instant starts=Instant.now().plusMillis(200);
        // 서로 다른 scheduledAt을 써 receipt/runKey 중복 폐기가 비중첩 검사를 가리지 않게 한다.
        scheduler.scheduleJob(TriggerBuilder.newTrigger().withIdentity(first).forJob(OperationalSchedulerService.jobKey("TEST_BLOCK")).startAt(Date.from(starts)).withSchedule(SimpleScheduleBuilder.simpleSchedule().withRepeatCount(0)).build());
        scheduler.scheduleJob(TriggerBuilder.newTrigger().withIdentity(second).forJob(OperationalSchedulerService.jobKey("TEST_BLOCK")).startAt(Date.from(starts.plusMillis(200))).withSchedule(SimpleScheduleBuilder.simpleSchedule().withRepeatCount(0)).build());
        scheduler.start();
        try{
            assertThat(probe.first.await(5,TimeUnit.SECONDS)).isTrue();
            assertThat(jdbc.queryForObject("SELECT TRIGGER_STATE FROM QRTZ_TRIGGERS WHERE TRIGGER_NAME=? AND TRIGGER_GROUP=?",String.class,second.getName(),second.getGroup())).isEqualTo("BLOCKED");
            assertThat(probe.second.await(750,TimeUnit.MILLISECONDS)).isFalse();
        }finally{probe.release.countDown();}
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(8);
        while(service.runs(0,20,row.id()).items().stream().filter(run->run.state().equals("SUCCESS")).count()<2&&System.nanoTime()<end)TimeUnit.MILLISECONDS.sleep(25);
        scheduler.standby();
        assertThat(probe.entries.get()).isEqualTo(2);assertThat(probe.maximum.get()).isEqualTo(1);assertThat(probe.active.get()).isZero();
        assertThat(service.runs(0,20,row.id()).items()).hasSize(2).allMatch(run->run.state().equals("SUCCESS"));
    }
    @Test void explicitDstZoneSkipsSpringGapAndUsesOneAutumnFold()throws Exception{
        var cron=new CronExpression("0 30 2 * * ?");cron.setTimeZone(java.util.TimeZone.getTimeZone(java.time.ZoneId.of("Europe/Berlin")));
        assertThat(cron.getNextValidTimeAfter(Date.from(Instant.parse("2026-03-28T23:00:00Z"))).toInstant()).isEqualTo(Instant.parse("2026-03-30T00:30:00Z"));
        var autumn=cron.getNextValidTimeAfter(Date.from(Instant.parse("2026-10-24T22:00:00Z"))).toInstant();
        assertThat(autumn).isEqualTo(Instant.parse("2026-10-25T01:30:00Z"));
        assertThat(cron.getNextValidTimeAfter(Date.from(autumn)).toInstant()).isEqualTo(Instant.parse("2026-10-26T01:30:00Z"));
    }
    @AfterEach void releaseBlockedTask()throws Exception{probe.release.countDown();scheduler.standby();}
    @AfterAll static void cleanup()throws Exception{OperationalTestSupport.cleanup(TEMP);}
}
