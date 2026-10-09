package __JAVA_PACKAGE__.integration;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
@FeignClient(name="starter-loopback",url="${starter.sample-http-url}")
public interface SampleClient {
    @GetMapping("/health") Health health();
    record Health(String status) {}
}
