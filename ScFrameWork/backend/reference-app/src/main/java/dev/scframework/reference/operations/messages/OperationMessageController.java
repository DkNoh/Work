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

@RestController @RequestMapping("/api/operations/messages")
@ConditionalOnProperty(prefix="sc.framework.messaging",name="enabled",havingValue="true")
public class OperationMessageController {
    private final ActorResolver actors;private final JdbcMessageStore store;private final DurableMessagePublisher publisher;private final MessageRegistry registry;private final Clock clock;
    public OperationMessageController(ActorResolver actors,JdbcMessageStore store,DurableMessagePublisher publisher,MessageRegistry registry,Clock clock){this.actors=actors;this.store=store;this.publisher=publisher;this.registry=registry;this.clock=clock;}
    @GetMapping @Transactional(readOnly=true)
    public OperationMessagePage list(Authentication authentication,@RequestParam(defaultValue="0") @Min(0) @Max(1000000) @Schema(type="integer",format="int32") int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) @Schema(type="integer",format="int32") int size,@RequestParam(required=false) String type,@RequestParam(required=false) JdbcMessageStore.State state){
        actors.requireAdmin(actors.require(authentication));if(type!=null&&!registry.types().contains(type))throw new ApiException(400,"INVALID_INPUT","메시지 종류를 확인하세요.");
        JdbcMessageStore.Page result=store.page(type,state,page,size);return new OperationMessagePage(result.items().stream().map(OperationMessageItem::from).toList(),result.total(),page,size);
    }
    @PostMapping("/{eventId}/retry") @ResponseStatus(HttpStatus.ACCEPTED) @Transactional
    public OperationMessageItem retry(Authentication authentication,@PathVariable UUID eventId,@RequestBody(required=false) EmptyCommand command){
        actors.requireAdmin(actors.require(authentication));if(store.find(eventId)==null)throw new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다.");
        if(!store.retry(eventId,clock.instant()))throw new ApiException(409,"CONFLICT","종료된 실패 메시지만 재시도할 수 있습니다.");return OperationMessageItem.from(store.find(eventId));
    }
    @PostMapping("/demo") @ResponseStatus(HttpStatus.ACCEPTED) @Transactional
    public OperationMessageItem demo(Authentication authentication,@RequestBody(required=false) EmptyCommand command){actors.requireAdmin(actors.require(authentication));ScMessage message=new ScMessage(UUID.randomUUID(),"MESSAGE_DEMO",1,clock.instant(),"{}");publisher.enqueue(message);return OperationMessageItem.from(store.find(message.eventId()));}
}
