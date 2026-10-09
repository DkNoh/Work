package dev.scframework.reference.menu;

import dev.scframework.reference.identity.ActorResolver;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import static dev.scframework.reference.menu.MenuDtos.*;

/**
 * 메뉴 lookup과 관리자 생성/수정 요청을 Service로 연결한다. 메뉴 선택지 읽기와 변경 권한은 같은 정책이 아니다.
 */

@RestController
@RequestMapping("/api/menus")
public class MenuController {
    private final MenuService menus;
    private final ActorResolver actors;
    public MenuController(MenuService menus, ActorResolver actors) { this.menus = menus; this.actors = actors; }
    @GetMapping public List<MenuResponse> list() { return menus.list(); }
    @PostMapping public MenuResponse create(@Valid @RequestBody MenuInput input, Authentication authentication) { return menus.create(input, actors.require(authentication)); }
    @PutMapping("/{id}") public MenuResponse update(@PathVariable long id, @Valid @RequestBody MenuEditInput input, Authentication authentication) { return menus.update(id, input, actors.require(authentication)); }
}
