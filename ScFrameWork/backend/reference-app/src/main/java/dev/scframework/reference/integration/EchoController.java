package dev.scframework.reference.integration;

import dev.scframework.autoconfigure.integration.FeignCallBoundary;
import dev.scframework.core.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 외부 연동 예제를 공통 Feign 오류 경계로 감싼다. 전송 성공뿐 아니라 앱이 요구하는 응답 내용도 확인한다.
 */

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
        // 공통 FeignCallBoundary가 timeout/외부 오류를 제한된 API 오류로 매핑한다. 이어지는 앱 검사는 200/204라도 필수 message가 없는 응답을 실패로 취급한다.
        ReferenceEchoClient.EchoResponse response = boundary.call(client::echo);
        // HTTP 성공이어도 앱이 사용하는 필수 응답 계약을 충족해야 한다.
        if (response == null || response.message() == null || response.message().isBlank()) {
            throw new ApiException(502, "UPSTREAM_FAILURE", "외부 서비스 응답이 올바르지 않습니다.");
        }
        return response;
    }
}
