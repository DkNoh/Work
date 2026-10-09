package __JAVA_PACKAGE__.operations;

import dev.scframework.autoconfigure.messaging.JdbcMessageStore;
import dev.scframework.autoconfigure.messaging.MessageRegistry;
import dev.scframework.core.ApiException;
import dev.scframework.core.messaging.DurableMessagePublisher;
import dev.scframework.core.messaging.ScMessage;
import java.time.Clock;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import __JAVA_PACKAGE__.operations.OperationMessageDtos.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import io.swagger.v3.oas.annotations.media.Schema;

/*
 * 메시징 기능 ON일 때 ADMIN용 상태 목록·실패 재시도·중립 demo 발행 API를 제공한다.
 * 목록 입력 type은 등록 레지스트리로 제한하고 쓰기는 @Transactional 안에서 outbox 저장소를 사용한다.
 * 202 응답은 명령 수락을 뜻하며 broker 전달/handler 완료는 이후 상태 조회로 확인한다.
 */

@RestController @RequestMapping("/api/operations/messages")
@ConditionalOnProperty(prefix="sc.framework.messaging",name="enabled",havingValue="true")
public class StarterMessageController {
    private final __JAVA_PACKAGE__.operations.scheduling.StarterOperationalActor actors;
    private final DurableMessagePublisher publisher;private final JdbcMessageStore store;private final Clock clock;private final MessageRegistry registry;
    public StarterMessageController(__JAVA_PACKAGE__.operations.scheduling.StarterOperationalActor actors,DurableMessagePublisher publisher,JdbcMessageStore store,Clock clock,MessageRegistry registry){this.actors=actors;this.publisher=publisher;this.store=store;this.clock=clock;this.registry=registry;}
    private void admin(Authentication authentication){actors.requireAdmin(actors.require(authentication));}
    @GetMapping @Transactional(readOnly=true)
    // 등록된 type만 허용하고 페이지 결과에서 payload를 제외한 공개 상태 DTO로 매핑한다.
    public OperationMessagePage list(Authentication authentication,@RequestParam(defaultValue="0") @Min(0) @Max(1000000) @Schema(type="integer",format="int32") int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) @Schema(type="integer",format="int32") int size,@RequestParam(required=false) String type,@RequestParam(required=false) JdbcMessageStore.State state){
        admin(authentication);if(type!=null&&!registry.types().contains(type))throw new ApiException(400,"INVALID_INPUT","메시지 종류를 확인하세요.");JdbcMessageStore.Page result=store.page(type,state,page,size);return new OperationMessagePage(result.items().stream().map(OperationMessageItem::from).toList(),result.total(),page,size);
    }
    @PostMapping("/{eventId}/retry") @ResponseStatus(HttpStatus.ACCEPTED) @Transactional
    // 행이 없으면 404, DEAD/미처리 조건을 만족하지 않으면 409다. 조건부 UPDATE가 동시 재시도 경쟁을 막는다.
    public OperationMessageItem retry(Authentication authentication,@PathVariable UUID eventId,@RequestBody(required=false) EmptyCommand command){admin(authentication);if(store.find(eventId)==null)throw new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다.");if(!store.retry(eventId,clock.instant()))throw new ApiException(409,"CONFLICT","종료된 실패 메시지만 재시도할 수 있습니다.");return OperationMessageItem.from(store.find(eventId));}
    @PostMapping("/demo") @ResponseStatus(HttpStatus.ACCEPTED) @Transactional
    // 현재 TX에 발행 의도를 기록한 뒤 상태를 반환한다. 이 메서드에서 Rabbit에 직접 전송하지 않는다.
    public OperationMessageItem demo(Authentication authentication,@RequestBody(required=false) EmptyCommand command){admin(authentication);ScMessage message=new ScMessage(UUID.randomUUID(),"MESSAGE_DEMO",1,clock.instant(),"{}");publisher.enqueue(message);return OperationMessageItem.from(store.find(message.eventId()));}
}
