package dev.scframework.reference;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaRoutes {
    @GetMapping({"/", "/login", "/dashboard", "/examples", "/patterns", "/requests", "/requests/{id:[0-9]+}", "/workspace", "/reports/requirements", "/admin", "/admin/users", "/admin/menus", "/admin/audit", "/account", "/kanban", "/notices", "/notices/new", "/notices/{id:[0-9]+}", "/documents", "/documents/new", "/documents/{id:[0-9]+}", "/screens", "/operations/messages", "/operations/schedules", "/operations/browser-errors"})
    public String app() { return "forward:/index.html"; }
}
