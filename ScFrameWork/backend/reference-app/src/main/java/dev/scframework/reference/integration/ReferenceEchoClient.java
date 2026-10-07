package dev.scframework.reference.integration;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import io.swagger.v3.oas.annotations.media.Schema;

@FeignClient(name = "referenceEcho", url = "${sc.reference.echo-url}")
public interface ReferenceEchoClient {
    @GetMapping("/echo") EchoResponse echo();
    record EchoResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message) {}
}
