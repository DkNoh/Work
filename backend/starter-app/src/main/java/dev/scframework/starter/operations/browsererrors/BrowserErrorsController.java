package dev.scframework.starter.operations.browsererrors;

import dev.scframework.autoconfigure.browsererrors.BrowserErrorService;
import dev.scframework.core.ApiException;
import dev.scframework.starter.operations.scheduling.StarterOperationalActor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import static dev.scframework.autoconfigure.browsererrors.BrowserErrorContracts.*;

/*
 * 선택 브라우저 오류 수집 API를 현재 인증 주체와 연결하는 앱 어댑터다.
 * report는 인증 사용자에게, groups/occurrences는 ADMIN에게 허용한다. 공통 서비스는 업무 사용자 저장소를 모른다.
 * 429에는 Retry-After를 붙이고 검증된 고정 코드 입력과 requestId만 공통 수집 서비스에 전달한다.
 */

@RestController @RequestMapping("/api/operations/browser-errors")
@ConditionalOnProperty(prefix="sc.framework.browser-errors",name="enabled",havingValue="true")
public class BrowserErrorsController {
    private final StarterOperationalActor actors;private final BrowserErrorService service;
    public BrowserErrorsController(StarterOperationalActor actors,BrowserErrorService service){this.actors=actors;this.service=service;}
    @PostMapping @ResponseStatus(HttpStatus.ACCEPTED) @Operation(operationId="collectBrowserError",summary="등록 코드의 브라우저 오류 보고")
    // 앱 인증 주체를 먼저 확정하고 빈도 제한을 통과한 입력만 DB 수집으로 전달한다. 클라이언트가 actor를 지정할 수 없다.
    public Accepted report(@Parameter(hidden=true) Authentication authentication,@RequestBody Input input,HttpServletResponse response){
        var actor=actors.require(authentication);
        try{service.admit(actor.getUsername());}catch(ApiException limited){if(limited.status()==429)response.setHeader("Retry-After",Integer.toString(service.retryAfterSeconds()));throw limited;}
        return service.accept(input,actor.getId(),actor.getUsername(),MDC.get("requestId"));
    }
    @GetMapping("/groups") @Operation(operationId="listBrowserErrorGroups",summary="브라우저 오류 집계 조회")
    // 수집 권한과 운영 조회 권한을 분리한다. 일반 인증 사용자가 다른 사용자 발생 이력을 읽지 못하게 ADMIN을 요구한다.
    public GroupPage groups(@Parameter(hidden=true) Authentication authentication,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(required=false) String source,@RequestParam(required=false) String eventCode){actors.requireAdmin(actors.require(authentication));return service.groups(page,size,source,eventCode);}
    @GetMapping("/groups/{id}/occurrences") @Operation(operationId="listBrowserErrorOccurrences",summary="브라우저 오류 발생 이력 조회")
    public OccurrencePage occurrences(@Parameter(hidden=true) Authentication authentication,@PathVariable long id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){actors.requireAdmin(actors.require(authentication));return service.occurrences(id,page,size);}
}
