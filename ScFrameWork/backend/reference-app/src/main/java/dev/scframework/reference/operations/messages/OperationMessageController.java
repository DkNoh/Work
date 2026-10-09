package dev.scframework.reference.operations.messages;

import dev.scframework.autoconfigure.messaging.*;
import dev.scframework.core.ApiException;
import dev.scframework.core.messaging.DurableMessagePublisher;
import dev.scframework.core.messaging.ScMessage;
import dev.scframework.reference.identity.ActorResolver;
import dev.scframework.reference.operations.messages.OperationMessageDtos.*;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import java.time.Clock;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * 메시징이 활성화된 경우의 ADMIN 운영 API다. 내구 메시지 상태 조회/실패 재시도/고정 데모 등록을 공통 store/publisher로 연결한다.
 * 202는 명령 접수이며 외부 브로커 전달/consumer 처리가 그 순간 완료되었다는 의미가 아니다.
 */

@RestController @RequestMapping("/api/operations/messages")
@ConditionalOnProperty(prefix="sc.framework.messaging",name="enabled",havingValue="true")
public class OperationMessageController {
    private final ActorResolver actors;private final JdbcMessageStore store;private final DurableMessagePublisher publisher;private final MessageRegistry registry;private final Clock clock;
    public OperationMessageController(ActorResolver actors,JdbcMessageStore store,DurableMessagePublisher publisher,MessageRegistry registry,Clock clock){this.actors=actors;this.store=store;this.publisher=publisher;this.registry=registry;this.clock=clock;}
    @GetMapping @Transactional(readOnly=true)
    // 현재 ADMIN과 등록된 message type을 확인한다. 내부 store 행을 공개 상태 DTO로 바꾸어 payload/저장소 세부 필드를 제외한다.
    public OperationMessagePage list(Authentication authentication,@RequestParam(defaultValue="0") @Min(0) @Max(1000000) @Schema(type="integer",format="int32") int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) @Schema(type="integer",format="int32") int size,@RequestParam(required=false) String type,@RequestParam(required=false) JdbcMessageStore.State state){
        actors.requireAdmin(actors.require(authentication));if(type!=null&&!registry.types().contains(type))throw new ApiException(400,"INVALID_INPUT","메시지 종류를 확인하세요.");
        JdbcMessageStore.Page result=store.page(type,state,page,size);return new OperationMessagePage(result.items().stream().map(OperationMessageItem::from).toList(),result.total(),page,size);
    }
    @PostMapping("/{eventId}/retry") @ResponseStatus(HttpStatus.ACCEPTED) @Transactional
    // 존재 확인 뒤 store의 조건부 상태 변경(CAS)이 성공해야 재시도가 접수된다. 이미 완료/재시도 불가 상태는 409이며 임의 payload 수정은 받지 않는다.
    public OperationMessageItem retry(Authentication authentication,@PathVariable UUID eventId,@RequestBody(required=false) EmptyCommand command){
        actors.requireAdmin(actors.require(authentication));if(store.find(eventId)==null)throw new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다.");
        if(!store.retry(eventId,clock.instant()))throw new ApiException(409,"CONFLICT","종료된 실패 메시지만 재시도할 수 있습니다.");return OperationMessageItem.from(store.find(eventId));
    }
    @PostMapping("/demo") @ResponseStatus(HttpStatus.ACCEPTED) @Transactional
    // 서버가 UUID/시각/고정 빈 payload를 만들어 내구 publisher에 넣는다. outbox 등록은 이 DB 트랜잭션에 속하며 요청자가 임의 종류/본문을 발행하는 API가 아니다.
    public OperationMessageItem demo(Authentication authentication,@RequestBody(required=false) EmptyCommand command){actors.requireAdmin(actors.require(authentication));ScMessage message=new ScMessage(UUID.randomUUID(),"MESSAGE_DEMO",1,clock.instant(),"{}");publisher.enqueue(message);return OperationMessageItem.from(store.find(message.eventId()));}
}
