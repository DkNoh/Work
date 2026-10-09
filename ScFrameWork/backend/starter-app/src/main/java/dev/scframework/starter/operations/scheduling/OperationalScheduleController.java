package dev.scframework.starter.operations.scheduling;

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

/*
 * 현재 앱의 ADMIN 권한과 감사를 공통 예약 서비스에 연결하는 Controller다.
 * JSON 입력의 nullable enabled/revision을 확인한 뒤 서비스 입력으로 바꾸고 공개 응답 record로 매핑한다.
 * 변경 메서드의 @Transactional은 예약 변경과 성공 감사 발행을 같은 호출 트랜잭션 경계에 둔다.
 */

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
    // 앱 권한 확인→서비스 생성/Quartz 반영→성공 감사 발행→공개 DTO 변환 순서다.
    public Schedule create(@Parameter(hidden=true) Authentication authentication,@RequestBody Input input){var actor=admin(authentication);var result=service.create(input(input),actor.getUsername());record(actor,"SCHEDULE_CREATE",result.id());return OperationalScheduleContracts.response(result);}
    @PutMapping("/schedules/{id}") @Transactional @Operation(operationId="updateOperationalSchedule",summary="운영 예약 변경")
    // 입력 revision을 서비스에 넘겨 동시 수정 409를 보존한다. 충돌한 요청을 자동 재실행하지 않는다.
    public Schedule update(@Parameter(hidden=true) Authentication authentication,@PathVariable long id,@RequestBody UpdateInput input){var actor=admin(authentication);if(input==null)throw invalid();var result=service.update(id,input(new Input(input.jobCode(),input.cron(),input.timeZone(),input.misfirePolicy(),input.enabled())),revision(input.revision()));record(actor,"SCHEDULE_UPDATE",id);return OperationalScheduleContracts.response(result);}
    @PostMapping("/schedules/{id}/pause") @Transactional @Operation(operationId="pauseOperationalSchedule",summary="운영 예약 일시정지")
    // 일시정지/재개도 revision 검사를 사용하는 상태 변경 명령이며 단순 화면 토글만 바꾸지 않는다.
    public Schedule pause(@Parameter(hidden=true) Authentication authentication,@PathVariable long id,@RequestBody RevisionInput input){var actor=admin(authentication);if(input==null)throw invalid();var result=service.enabled(id,false,revision(input.revision()));record(actor,"SCHEDULE_PAUSE",id);return OperationalScheduleContracts.response(result);}
    @PostMapping("/schedules/{id}/resume") @Transactional @Operation(operationId="resumeOperationalSchedule",summary="운영 예약 재개")
    public Schedule resume(@Parameter(hidden=true) Authentication authentication,@PathVariable long id,@RequestBody RevisionInput input){var actor=admin(authentication);if(input==null)throw invalid();var result=service.enabled(id,true,revision(input.revision()));record(actor,"SCHEDULE_RESUME",id);return OperationalScheduleContracts.response(result);}
    @GetMapping("/runs") @Operation(operationId="listOperationalRuns",summary="운영 실행 이력 조회")
    public RunPage runs(@Parameter(hidden=true) Authentication authentication,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(required=false) Long scheduleId){admin(authentication);return OperationalScheduleContracts.runs(service.runs(page,size,scheduleId));}
    private StarterOperationalActor.Actor admin(Authentication authentication){var actor=actors.require(authentication);actors.requireAdmin(actor);return actor;}
    private static OperationalSchedulerService.Input input(Input input){if(input==null||input.enabled()==null)throw invalid();return new OperationalSchedulerService.Input(input.jobCode(),input.cron(),input.timeZone(),input.misfirePolicy(),input.enabled());}
    private static int revision(Integer value){if(value==null||value<1)throw invalid();return value;}
    private static ApiException invalid(){return new ApiException(400,"INVALID_INPUT","예약 작업 입력을 확인해 주세요.");}
    // 업무 본문/cron 원문 대신 고정 action과 예약 식별자만 감사 이벤트로 발행한다.
    private void record(StarterOperationalActor.Actor actor,String action,long id){audit.publish(new SecurityAuditEvent(actor.getUsername(),actor.getId(),clock.instant(),action,"SUCCESS","SCHEDULE",Long.toString(id),MDC.get("requestId"),null));}
}
