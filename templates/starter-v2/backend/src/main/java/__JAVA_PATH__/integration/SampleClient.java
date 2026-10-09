package __JAVA_PACKAGE__.integration;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

/*
 * 생성 앱의 서버 외부 HTTP 계약이다. 지정 URL의 /health 응답을 Health record로 받는다.
 * @FeignClient를 명시 목록으로 등록하며 URL/timeout 설정은 앱 설정이 소유한다. 브라우저 Axios와는 별도 서버 호출이다.
 */
@FeignClient(name="starter-loopback",url="${starter.sample-http-url}")
public interface SampleClient {
    @GetMapping("/health") Health health();
    record Health(String status) {}
}
