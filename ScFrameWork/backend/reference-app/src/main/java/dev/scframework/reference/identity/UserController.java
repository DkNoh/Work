package dev.scframework.reference.identity;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import static dev.scframework.reference.identity.UserDtos.*;

/**
 * 인증 사용자 조회·관리자 사용자 생성·본인 비밀번호 변경의 HTTP 경계다.
 * 성공 DTO는 그대로 반환하며 공통 오류 처리가 ApiException을 code/message/errors 계약으로 바꾼다.
 */

@RestController
@RequestMapping("/api")
public class UserController {
    private final ActorResolver actors;
    private final UserService users;
    public UserController(ActorResolver actors, UserService users) { this.actors = actors; this.users = users; }
    @GetMapping("/auth/me")
    public UserResponse me(Authentication authentication) { return UserResponse.from(actors.require(authentication)); }
    @GetMapping("/users")
    public List<UserResponse> list() { return users.list(); }
    @PostMapping("/users")
    public UserResponse create(@Valid @RequestBody NewUserInput input, Authentication authentication) { return users.create(input, actors.require(authentication)); }
    @PostMapping("/auth/password")
    // Service 프록시 호출이 정상 반환하면 그 트랜잭션은 commit된 상태다. 그 뒤에만 현재 HttpSession을 무효화해 실패한 변경에서 로그아웃시키지 않는다.
    public ResponseEntity<Void> password(@Valid @RequestBody PasswordInput input, Authentication authentication, HttpServletRequest request) {
        users.changePassword(input, actors.require(authentication));
        // Service transaction의 commit 이후 현재 세션만 끝낸다. 실패한 저장에서는 세션을 유지한다.
        var session = request.getSession(false);
        if (session != null) session.invalidate();
        return ResponseEntity.noContent().build();
    }
}
