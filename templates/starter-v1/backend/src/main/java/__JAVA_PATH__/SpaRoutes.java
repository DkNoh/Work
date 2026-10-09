package __JAVA_PACKAGE__;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
@Controller
public class SpaRoutes {
    @GetMapping({"/", "/login", "/notes", "/notes/{id:[0-9]+}", "/patterns"})
    public String app() { return "forward:/index.html"; }
}
