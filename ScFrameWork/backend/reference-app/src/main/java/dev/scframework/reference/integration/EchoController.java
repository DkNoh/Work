package dev.scframework.reference.integration;

import dev.scframework.autoconfigure.integration.FeignCallBoundary;
import dev.scframework.core.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EchoController {
    private final ReferenceEchoClient client;
    private final FeignCallBoundary boundary;
    public EchoController(ReferenceEchoClient client, FeignCallBoundary boundary) {
        this.client = client; this.boundary = boundary;
    }

    @GetMapping("/api/integration/echo")
    @Operation(summary = "OpenFeign 외부 HTTP 연결 예제")
    public ReferenceEchoClient.EchoResponse echo() {
        ReferenceEchoClient.EchoResponse response = boundary.call(client::echo);
        // HTTP 성공이어도 앱이 사용하는 필수 응답 계약을 충족해야 한다.
        if (response == null || response.message() == null || response.message().isBlank()) {
            throw new ApiException(502, "UPSTREAM_FAILURE", "외부 서비스 응답이 올바르지 않습니다.");
        }
        return response;
    }
}
