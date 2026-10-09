package dev.scframework.reference.integration;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 명시적으로 등록하는 외부 HTTP Feign client다. URL은 앱 설정으로 주입하고 호출 명세는 GET /echo 하나다.
 * 수신 사용자 cookie/CSRF를 여기서 인수로 받거나 외부로 자동 전달하지 않는다. 검증은 loopback mock을 사용한다.
 */

@FeignClient(name = "referenceEcho", url = "${sc.reference.echo-url}")
public interface ReferenceEchoClient {
    @GetMapping("/echo") EchoResponse echo();
    record EchoResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message) {}
}
