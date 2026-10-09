package dev.scframework.reference.operations.browsererrors;

import dev.scframework.autoconfigure.browsererrors.BrowserErrorService;
import dev.scframework.core.ApiException;
import dev.scframework.reference.identity.ActorResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import static dev.scframework.autoconfigure.browsererrors.BrowserErrorContracts.*;

/**
 * 브라우저 오류 기능 활성 시 등록 코드 기반 보고와 ADMIN 집계 조회를 제공한다.
 * 보고자는 인증 사용자면 가능하고 조회는 ADMIN만 가능하다. 수집 내용 검증/저장/제한은 공통 BrowserErrorService가 맡는다.
 */

@RestController @RequestMapping("/api/operations/browser-errors")
@ConditionalOnProperty(prefix="sc.framework.browser-errors",name="enabled",havingValue="true")
public class BrowserErrorsController {
    private final ActorResolver actors;private final BrowserErrorService service;
    public BrowserErrorsController(ActorResolver actors,BrowserErrorService service){this.actors=actors;this.service=service;}
    @PostMapping @ResponseStatus(HttpStatus.ACCEPTED) @Operation(operationId="collectBrowserError",summary="등록 코드의 브라우저 오류 보고")
    // 일반 인증 사용자도 자신의 등록 오류 코드를 보고할 수 있다. 먼저 사용자 단위 수집 한도를 검사하고 429이면 Retry-After를 응답한다.
    public Accepted report(@Parameter(hidden=true) Authentication authentication,@RequestBody Input input,HttpServletResponse response){
        var actor=actors.require(authentication);
        try{service.admit(actor.getUsername());}catch(ApiException limited){if(limited.status()==429)response.setHeader("Retry-After",Integer.toString(service.retryAfterSeconds()));throw limited;}
        // 검증/그룹화는 공통 Service에 위임한다. actor와 requestId는 요청 body가 아니라 서버 인증/MDC에서 주입한다.
        return service.accept(input,actor.getId(),actor.getUsername(),MDC.get("requestId"));
    }
    @GetMapping("/groups") @Operation(operationId="listBrowserErrorGroups",summary="브라우저 오류 집계 조회")
    // 집계 읽기는 현재 DB ADMIN만 허용한다. 오류 보고 권한과 운영 조회 권한을 같은 수준으로 열지 않는다.
    public GroupPage groups(@Parameter(hidden=true) Authentication authentication,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(required=false) String source,@RequestParam(required=false) String eventCode){actors.requireAdmin(actors.require(authentication));return service.groups(page,size,source,eventCode);}
    @GetMapping("/groups/{id}/occurrences") @Operation(operationId="listBrowserErrorOccurrences",summary="브라우저 오류 발생 이력 조회")
    // 그룹별 발생 이력도 동일 ADMIN 경계를 거친다. stack/message 원문을 임의로 조회하는 API가 아니다.
    public OccurrencePage occurrences(@Parameter(hidden=true) Authentication authentication,@PathVariable long id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){actors.requireAdmin(actors.require(authentication));return service.occurrences(id,page,size);}
}
