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
    public UserEntity authorized(Authentication authentication) {
        UserEntity actor = actors.require(authentication);
        if (!allowed(actor)) throw forbidden();
        return actor;
    }
    public KanbanAccessResponse access(Authentication authentication) { return new KanbanAccessResponse(allowed(actors.require(authentication))); }
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
