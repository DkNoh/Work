package dev.scframework.starter;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaRoutes {
    @GetMapping({"/", "/login", "/patterns", "/operations/messages", "/operations/schedules", "/operations/browser-errors"})
    public String app() { return "forward:/index.html"; }
}
