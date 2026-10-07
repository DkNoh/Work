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

@RestController @RequestMapping("/api/operations/browser-errors")
@ConditionalOnProperty(prefix="sc.framework.browser-errors",name="enabled",havingValue="true")
public class BrowserErrorsController {
    private final ActorResolver actors;private final BrowserErrorService service;
    public BrowserErrorsController(ActorResolver actors,BrowserErrorService service){this.actors=actors;this.service=service;}
    @PostMapping @ResponseStatus(HttpStatus.ACCEPTED) @Operation(operationId="collectBrowserError",summary="등록 코드의 브라우저 오류 보고")
    public Accepted report(@Parameter(hidden=true) Authentication authentication,@RequestBody Input input,HttpServletResponse response){
        var actor=actors.require(authentication);
        try{service.admit(actor.getUsername());}catch(ApiException limited){if(limited.status()==429)response.setHeader("Retry-After",Integer.toString(service.retryAfterSeconds()));throw limited;}
        return service.accept(input,actor.getId(),actor.getUsername(),MDC.get("requestId"));
    }
    @GetMapping("/groups") @Operation(operationId="listBrowserErrorGroups",summary="브라우저 오류 집계 조회")
    public GroupPage groups(@Parameter(hidden=true) Authentication authentication,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(required=false) String source,@RequestParam(required=false) String eventCode){actors.requireAdmin(actors.require(authentication));return service.groups(page,size,source,eventCode);}
    @GetMapping("/groups/{id}/occurrences") @Operation(operationId="listBrowserErrorOccurrences",summary="브라우저 오류 발생 이력 조회")
    public OccurrencePage occurrences(@Parameter(hidden=true) Authentication authentication,@PathVariable long id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){actors.requireAdmin(actors.require(authentication));return service.occurrences(id,page,size);}
}
