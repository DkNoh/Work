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
    public MenuEntity requireActive(long id) {
        MenuEntity menu = require(id);
        if (menu.getActive() != 1) throw new ApiException(400, "INVALID_INPUT", "보관된 메뉴에는 새 요청을 등록할 수 없습니다.");
        return menu;
    }
    @Transactional
    public MenuResponse create(MenuInput input, UserEntity actor) {
        actors.requireAdmin(actor);
        if (input.parentId() != null) requireActive(input.parentId());
        MenuEntity menu = menus.saveAndFlush(new MenuEntity(input.parentId(), input.name(), input.sortOrder()));
        publish(actor, "MENU_CREATE", menu.getId());
        return MenuResponse.from(menu);
    }
    @Transactional
    public MenuResponse update(long id, MenuEditInput input, UserEntity actor) {
        actors.requireAdmin(actor);
        MenuEntity menu = require(id);
        menu.edit(input.name(), input.sortOrder(), input.active()); menus.flush();
        publish(actor, "MENU_UPDATE", id);
        return MenuResponse.from(menu);
    }
    private void publish(UserEntity actor, String action, long id) {
        audit.publish(new SecurityAuditEvent(actor.getUsername(), actor.getId(), clock.instant().truncatedTo(ChronoUnit.MICROS), action, "SUCCESS", "MENU", Long.toString(id), null, null));
    }
}
