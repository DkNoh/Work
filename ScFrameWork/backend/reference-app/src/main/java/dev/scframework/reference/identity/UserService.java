package dev.scframework.reference.identity;

import dev.scframework.autoconfigure.security.SecretFileUsers;
import dev.scframework.core.ApiException;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditPublisher;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static dev.scframework.reference.identity.UserDtos.*;

@Service
public class UserService {
    private final UserRepository users;
    private final ActorResolver actors;
    private final PasswordEncoder encoder;
    private final Clock clock;
    private final SecurityAuditPublisher audit;
    public UserService(UserRepository users, ActorResolver actors, PasswordEncoder encoder, Clock clock, SecurityAuditPublisher audit) {
        this.users = users; this.actors = actors; this.encoder = encoder; this.clock = clock; this.audit = audit;
    }
    @Transactional(readOnly = true)
    public List<UserResponse> list() { return users.findAllByOrderByDisplayNameAsc().stream().map(UserResponse::from).toList(); }
    @Transactional
    public UserResponse create(NewUserInput input, UserEntity actor) {
        actors.requireAdmin(actor);
        if (input.password().length() < 12 || input.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(400, "INVALID_INPUT", "비밀번호는 12자 이상, UTF-8 72바이트 이하로 입력하세요.");
        UserEntity created = users.saveAndFlush(new UserEntity(input.username(), input.displayName(), encoder.encode(input.password()), input.role(), now()));
        audit.publish(new SecurityAuditEvent(actor.getUsername(), actor.getId(), now(), "USER_CREATE", "SUCCESS", "USER", created.getId().toString(), null, null));
        return UserResponse.from(created);
    }
    @Transactional
    public void changePassword(PasswordInput input, UserEntity actor) {
        if (input.newPassword().length() < 12 || input.newPassword().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(400, "INVALID_INPUT", "비밀번호는 12자 이상, UTF-8 72바이트 이하로 입력하세요.");
        UserEntity current = users.findForPasswordChange(actor.getId())
                .orElseThrow(() -> new ApiException(401, "AUTH_REQUIRED", "로그인이 필요합니다."));
        if (!encoder.matches(input.currentPassword(), current.getPasswordHash()))
            throw new ApiException(400, "INVALID_INPUT", "현재 비밀번호가 일치하지 않습니다.");
        current.changePasswordHash(encoder.encode(input.newPassword()));
        users.flush();
        audit.publish(new SecurityAuditEvent(current.getUsername(), current.getId(), now(), "PASSWORD_CHANGE", "SUCCESS", "USER", current.getId().toString(), null, null));
    }
    @Transactional
    public void bootstrap(Environment environment) {
        // 기존 DB가 있으면 파일 재검사/암호 재설정을 하지 않는다. 새 파일의 검증 정책은 공통 helper를 재사용한다.
        if (users.count() != 0) return;
        String username = environment.getProperty("SC_BOOTSTRAP_USERNAME", "admin");
        var initial = SecretFileUsers.load(environment.getProperty("SC_BOOTSTRAP_SECRET_FILE"), username, encoder).loadUserByUsername(username);
        users.saveAndFlush(new UserEntity(username, "관리자", initial.getPassword(), "ADMIN", now()));
    }
    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MICROS); }
}
