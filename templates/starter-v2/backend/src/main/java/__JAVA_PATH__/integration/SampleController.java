package __JAVA_PACKAGE__.integration;
import dev.scframework.autoconfigure.integration.FeignCallBoundary;
import dev.scframework.core.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/*
 * 앱의 Feign health 호출을 공통 외부 오류 경계로 감싼 REST 예제다.
 * 통신 성공 뒤에도 status=UP 응답인지 검사해 잘못된 upstream JSON을 정상 업무 결과로 전달하지 않는다.
 */
@RestController
public class SampleController {
    private final SampleClient client;private final FeignCallBoundary boundary;
    public SampleController(SampleClient client,FeignCallBoundary boundary) {this.client=client;this.boundary=boundary;}
    @GetMapping("/api/integration/sample")
    public SampleClient.Health sample() {
        SampleClient.Health value=boundary.call(client::health);
        if(value==null || !"UP".equals(value.status())) throw new ApiException(502,"INVALID_UPSTREAM","외부 응답 형식을 확인할 수 없습니다.");return value;
    }
}
