package __JAVA_PACKAGE__.operations.scheduling;

import dev.scframework.autoconfigure.scheduling.OperationalScheduleContracts;
import dev.scframework.autoconfigure.scheduling.OperationalSchedulerService;
import dev.scframework.core.ApiException;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditPublisher;


import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import java.time.Clock;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import static dev.scframework.autoconfigure.scheduling.OperationalScheduleContracts.*;

@RestController
@RequestMapping("/api/operations/jobs")
@ConditionalOnProperty(prefix="sc.framework.scheduler",name="enabled",havingValue="true")
public class OperationalScheduleController {
    private final StarterOperationalActor actors;private final OperationalSchedulerService service;private final SecurityAuditPublisher audit;private final Clock clock;
    public OperationalScheduleController(StarterOperationalActor actors,OperationalSchedulerService service,SecurityAuditPublisher audit,Clock clock){this.actors=actors;this.service=service;this.audit=audit;this.clock=clock;}
    @GetMapping("/registered") @Operation(operationId="registeredOperationalJobs",summary="등록 운영 작업 조회")
    public RegisteredJobs registered(@Parameter(hidden=true) Authentication authentication){admin(authentication);return new RegisteredJobs(service.registered().stream().map(task->new RegisteredJob(task.jobCode(),task.executionMode().name())).toList());}
    @GetMapping("/schedules") @Operation(operationId="listOperationalSchedules",summary="운영 예약 조회")
    public SchedulePage schedules(@Parameter(hidden=true) Authentication authentication,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){admin(authentication);return OperationalScheduleContracts.response(service.schedules(page,size));}
    @GetMapping("/schedules/{id}") @Operation(operationId="getOperationalSchedule",summary="운영 예약 단건 조회")
    public Schedule detail(@Parameter(hidden=true) Authentication authentication,@PathVariable long id){admin(authentication);return OperationalScheduleContracts.response(service.detail(id));}
    @PostMapping("/schedules") @Transactional @Operation(operationId="createOperationalSchedule",summary="등록 작업 예약")
    public Schedule create(@Parameter(hidden=true) Authentication authentication,@RequestBody Input input){var actor=admin(authentication);var result=service.create(input(input),actor.getUsername());record(actor,"SCHEDULE_CREATE",result.id());return OperationalScheduleContracts.response(result);}
    @PutMapping("/schedules/{id}") @Transactional @Operation(operationId="updateOperationalSchedule",summary="운영 예약 변경")
    public Schedule update(@Parameter(hidden=true) Authentication authentication,@PathVariable long id,@RequestBody UpdateInput input){var actor=admin(authentication);if(input==null)throw invalid();var result=service.update(id,input(new Input(input.jobCode(),input.cron(),input.timeZone(),input.misfirePolicy(),input.enabled())),revision(input.revision()));record(actor,"SCHEDULE_UPDATE",id);return OperationalScheduleContracts.response(result);}
    @PostMapping("/schedules/{id}/pause") @Transactional @Operation(operationId="pauseOperationalSchedule",summary="운영 예약 일시정지")
    public Schedule pause(@Parameter(hidden=true) Authentication authentication,@PathVariable long id,@RequestBody RevisionInput input){var actor=admin(authentication);if(input==null)throw invalid();var result=service.enabled(id,false,revision(input.revision()));record(actor,"SCHEDULE_PAUSE",id);return OperationalScheduleContracts.response(result);}
    @PostMapping("/schedules/{id}/resume") @Transactional @Operation(operationId="resumeOperationalSchedule",summary="운영 예약 재개")
    public Schedule resume(@Parameter(hidden=true) Authentication authentication,@PathVariable long id,@RequestBody RevisionInput input){var actor=admin(authentication);if(input==null)throw invalid();var result=service.enabled(id,true,revision(input.revision()));record(actor,"SCHEDULE_RESUME",id);return OperationalScheduleContracts.response(result);}
    @GetMapping("/runs") @Operation(operationId="listOperationalRuns",summary="운영 실행 이력 조회")
    public RunPage runs(@Parameter(hidden=true) Authentication authentication,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(required=false) Long scheduleId){admin(authentication);return OperationalScheduleContracts.runs(service.runs(page,size,scheduleId));}
    private StarterOperationalActor.Actor admin(Authentication authentication){var actor=actors.require(authentication);actors.requireAdmin(actor);return actor;}
    private static OperationalSchedulerService.Input input(Input input){if(input==null||input.enabled()==null)throw invalid();return new OperationalSchedulerService.Input(input.jobCode(),input.cron(),input.timeZone(),input.misfirePolicy(),input.enabled());}
    private static int revision(Integer value){if(value==null||value<1)throw invalid();return value;}
    private static ApiException invalid(){return new ApiException(400,"INVALID_INPUT","예약 작업 입력을 확인해 주세요.");}
    private void record(StarterOperationalActor.Actor actor,String action,long id){audit.publish(new SecurityAuditEvent(actor.getUsername(),actor.getId(),clock.instant(),action,"SUCCESS","SCHEDULE",Long.toString(id),MDC.get("requestId"),null));}
}
