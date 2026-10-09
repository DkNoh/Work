package dev.scframework.starter;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/*
 * 브라우저에서 SPA 화면 URL로 직접 접근하거나 새로고침할 때 index.html로 내부 forward한다.
 * @Controller의 문자열은 view/forward 명령이며 REST JSON 응답과 다르다. 실제 화면 선택은 Vue Router가 맡는다.
 * 명시된 화면 경로만 매핑해 /api 오류나 정적 파일 누락을 무조건 index.html로 숨기지 않는다.
 */

@Controller
public class SpaRoutes {
    @GetMapping({"/", "/login", "/patterns", "/operations/messages", "/operations/schedules", "/operations/browser-errors"})
    public String app() { return "forward:/index.html"; }
}
