package dev.scframework.reference.kanban;

import static dev.scframework.reference.kanban.KanbanDtos.*;
import dev.scframework.core.ApiException;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditPublisher;
import dev.scframework.reference.identity.*;
import java.time.Clock;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 칸반 접근은 현재 DB ADMIN 또는 kanban_member 등록으로 결정한다. 세션의 과거 역할/프런트 메뉴 가시성에 의존하지 않는다.
 * 일반 담당자 선택지는 접근 가능한 사용자만, 멤버 관리 목록/변경은 ADMIN만 사용할 수 있다.
 */

@Service @Transactional(readOnly = true)
public class KanbanAccessService {
    private final ActorResolver actors;
    private final UserRepository users;
    private final KanbanMemberRepository members;
    private final SecurityAuditPublisher audit;
    private final Clock clock;
    public KanbanAccessService(ActorResolver actors, UserRepository users, KanbanMemberRepository members, SecurityAuditPublisher audit, Clock clock) {
        this.actors = actors; this.users = users; this.members = members; this.audit = audit; this.clock = clock;
    }
    // 현재 DB actor를 얻고 ADMIN 또는 멤버 존재를 검사한다. 이 메서드를 통과한 actor를 이후 작성자/담당자 검사에 사용한다.
    public UserEntity authorized(Authentication authentication) {
        UserEntity actor = actors.require(authentication);
        if (!allowed(actor)) throw forbidden();
        return actor;
    }
    public KanbanAccessResponse access(Authentication authentication) { return new KanbanAccessResponse(allowed(actors.require(authentication))); }
    // 담당자 옵션은 허용 멤버+ADMIN으로 제한한다. 모든 계정을 무조건 칸반 담당자로 노출하지 않는다.
    public List<KanbanUserResponse> users(Authentication authentication) {
        authorized(authentication); Set<Long> memberIds = memberIds();
        return users.findAllByOrderByDisplayNameAsc().stream().filter(user -> user.isAdmin() || memberIds.contains(user.getId()))
                .map(user -> new KanbanUserResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getRole())).toList();
    }
    public List<KanbanMemberResponse> members(Authentication authentication) {
        actors.requireAdmin(actors.require(authentication)); Set<Long> memberIds = memberIds();
        return users.findAllByOrderByDisplayNameAsc().stream().map(user -> member(user, user.isAdmin() || memberIds.contains(user.getId()))).toList();
    }
    @Transactional
    // ADMIN만 일반 멤버 행을 추가/삭제한다. ADMIN 대상은 멤버 행과 무관하게 항상 허용하며 실제 허용 여부가 바뀐 경우만 감사를 발행한다.
    public KanbanMemberResponse membership(long id, boolean allowed, Authentication authentication) {
        UserEntity actor = actors.require(authentication); actors.requireAdmin(actor);
        UserEntity target = users.findById(id).orElseThrow(KanbanAccessService::missing);
        boolean before = allowed(target);
        if (!target.isAdmin()) {
            if (allowed && !members.existsById(id)) members.saveAndFlush(new KanbanMemberEntity(id));
            else if (!allowed && members.existsById(id)) { members.deleteById(id); members.flush(); }
        }
        boolean after = allowed(target);
        if (before != after) audit.publish(new SecurityAuditEvent(actor.getUsername(), actor.getId(), clock.instant(), "KANBAN_MEMBER_UPDATE", "SUCCESS", "KANBAN_MEMBER", Long.toString(id), null, null));
        return member(target, after);
    }
    public boolean allowed(UserEntity user) { return user.isAdmin() || members.existsById(user.getId()); }
    private Set<Long> memberIds() { Set<Long> ids = new HashSet<>(); members.findAll().forEach(row -> ids.add(row.getUserId())); return ids; }
    private static KanbanMemberResponse member(UserEntity user, boolean allowed) { return new KanbanMemberResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getRole(), allowed); }
    public static ApiException forbidden() { return new ApiException(403, "FORBIDDEN", "이 작업을 수행할 권한이 없습니다."); }
    public static ApiException missing() { return new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없습니다."); }
}
