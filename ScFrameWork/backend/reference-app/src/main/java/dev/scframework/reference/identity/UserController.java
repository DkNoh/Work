package dev.scframework.reference.identity;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import static dev.scframework.reference.identity.UserDtos.*;

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
    public ResponseEntity<Void> password(@Valid @RequestBody PasswordInput input, Authentication authentication, HttpServletRequest request) {
        users.changePassword(input, actors.require(authentication));
        // Service transaction의 commit 이후 현재 세션만 끝낸다. 실패한 저장에서는 세션을 유지한다.
        var session = request.getSession(false);
        if (session != null) session.invalidate();
        return ResponseEntity.noContent().build();
    }
}
