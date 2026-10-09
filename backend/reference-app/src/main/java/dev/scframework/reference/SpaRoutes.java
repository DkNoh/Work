package dev.scframework.reference;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * 브라우저가 업무 URL을 직접 열거나 새로고침했을 때 Vue 진입 HTML로 전달한다.
 * JSP view를 렌더링하는 컨트롤러가 아니며 API/파일 경로까지 포괄하는 wildcard forward를 두지 않는다.
 */

@Controller
public class SpaRoutes {
    @GetMapping({"/", "/login", "/dashboard", "/examples", "/patterns", "/requests", "/requests/{id:[0-9]+}", "/workspace", "/reports/requirements", "/admin", "/admin/users", "/admin/menus", "/admin/audit", "/account", "/kanban", "/notices", "/notices/new", "/notices/{id:[0-9]+}", "/documents", "/documents/new", "/documents/{id:[0-9]+}", "/screens", "/operations/messages", "/operations/schedules", "/operations/browser-errors"})
    public String app() { return "forward:/index.html"; }
}
