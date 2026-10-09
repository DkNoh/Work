package dev.scframework.reference.menu;

import dev.scframework.core.ApiException;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditPublisher;
import dev.scframework.reference.identity.ActorResolver;
import dev.scframework.reference.identity.UserEntity;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static dev.scframework.reference.menu.MenuDtos.*;

/**
 * 메뉴 생성/변경은 현재 DB ADMIN만 허용한다. 비활성 메뉴의 기존 조회와 새 요청 허용 여부를 분리한다.
 * 변경과 감사 발행은 같은 호출 트랜잭션에서 수행하며 메뉴 목록은 읽기 전용 조회다.
 */

@Service
public class MenuService {
    private final MenuRepository menus;
    private final ActorResolver actors;
    private final Clock clock;
    private final SecurityAuditPublisher audit;
    public MenuService(MenuRepository menus, ActorResolver actors, Clock clock, SecurityAuditPublisher audit) { this.menus = menus; this.actors = actors; this.clock = clock; this.audit = audit; }
    @Transactional(readOnly = true)
    public List<MenuResponse> list() { return menus.findAllByOrderBySortOrderAscIdAsc().stream().map(MenuResponse::from).toList(); }
    @Transactional(readOnly = true)
    public MenuEntity require(long id) { return menus.findById(id).orElseThrow(() -> new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없습니다.")); }
    @Transactional(readOnly = true)
    // 기존 보관 메뉴 참조는 조회 가능하지만 새 업무/상위 메뉴 선택은 active=1이어야 한다.
    public MenuEntity requireActive(long id) {
        MenuEntity menu = require(id);
        if (menu.getActive() != 1) throw new ApiException(400, "INVALID_INPUT", "보관된 메뉴에는 새 요청을 등록할 수 없습니다.");
        return menu;
    }
    @Transactional
    // ADMIN 확인 후 상위 메뉴가 있으면 활성 상태를 검사한다. 저장과 성공 감사 발행을 한 트랜잭션에서 수행한다.
    public MenuResponse create(MenuInput input, UserEntity actor) {
        actors.requireAdmin(actor);
        if (input.parentId() != null) requireActive(input.parentId());
        MenuEntity menu = menus.saveAndFlush(new MenuEntity(input.parentId(), input.name(), input.sortOrder()));
        publish(actor, "MENU_CREATE", menu.getId());
        return MenuResponse.from(menu);
    }
    @Transactional
    // 관리자가 기존 메뉴의 이름/순서/사용 여부만 변경한다. parentId 변경이나 별도 revision 계약을 여기서 추가하지 않는다.
    public MenuResponse update(long id, MenuEditInput input, UserEntity actor) {
        actors.requireAdmin(actor);
        MenuEntity menu = require(id);
        menu.edit(input.name(), input.sortOrder(), input.active()); menus.flush();
        publish(actor, "MENU_UPDATE", id);
        return MenuResponse.from(menu);
    }
    // 보안 감사에는 actor/대상 ID/행동 코드만 담는다. 메뉴 상세 전체를 감사 payload로 복사하지 않는다.
    private void publish(UserEntity actor, String action, long id) {
        audit.publish(new SecurityAuditEvent(actor.getUsername(), actor.getId(), clock.instant().truncatedTo(ChronoUnit.MICROS), action, "SUCCESS", "MENU", Long.toString(id), null, null));
    }
}
