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

/**
 * 사용자 등록/비밀번호 변경의 트랜잭션 경계다. 권한/비밀번호 정책 확인 후 해시만 저장하고 감사 메타데이터를 발행한다.
 * bootstrap은 비어 있는 앱 DB에만 초기 관리자를 만들며 기존 실행 자료의 암호를 덮어쓰지 않는다.
 */

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
    // 현재 ADMIN 확인 → 문자/UTF-8 바이트 제한 → 해시 저장/flush → 사용자 생성 감사 발행 순서다. 응답은 공개 DTO만 만든다.
    public UserResponse create(NewUserInput input, UserEntity actor) {
        actors.requireAdmin(actor);
        if (input.password().length() < 12 || input.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(400, "INVALID_INPUT", "비밀번호는 12자 이상, UTF-8 72바이트 이하로 입력하세요.");
        UserEntity created = users.saveAndFlush(new UserEntity(input.username(), input.displayName(), encoder.encode(input.password()), input.role(), now()));
        audit.publish(new SecurityAuditEvent(actor.getUsername(), actor.getId(), now(), "USER_CREATE", "SUCCESS", "USER", created.getId().toString(), null, null));
        return UserResponse.from(created);
    }
    @Transactional
    // 사용자 행 잠금 후 현재 해시를 다시 확인한다. 경쟁 변경 사이에 오래된 비밀번호 확인이 통과하지 않게 하고 성공 변경을 flush한다.
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
    // 기존 사용자 행이 하나라도 있으면 즉시 종료한다. 새 DB에만 보안 helper로 초기 해시를 얻으며 원문을 복사하거나 출력하지 않는다.
    public void bootstrap(Environment environment) {
        // 기존 DB가 있으면 파일 재검사/암호 재설정을 하지 않는다. 새 파일의 검증 정책은 공통 helper를 재사용한다.
        if (users.count() != 0) return;
        String username = environment.getProperty("SC_BOOTSTRAP_USERNAME", "admin");
        var initial = SecretFileUsers.load(environment.getProperty("SC_BOOTSTRAP_SECRET_FILE"), username, encoder).loadUserByUsername(username);
        users.saveAndFlush(new UserEntity(username, "관리자", initial.getPassword(), "ADMIN", now()));
    }
    // H2 저장 정밀도와 응답/감사 시각 비교를 맞추기 위해 주입 Clock의 값을 마이크로초로 정규화한다.
    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MICROS); }
}
