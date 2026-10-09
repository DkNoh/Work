package dev.scframework.reference.example;

import dev.scframework.core.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 가장 작은 HTTP→Service→JPA CRUD 예제다. 목록은 0 기반 페이지이며 성공 JSON은 ExamplePage/ExampleDto 그대로다.
 * 입력 검증과 revision 누락 검사를 HTTP 경계에서 수행하고 실제 동시성 판단은 Service/DB에서 수행한다.
 */

@RestController
@RequestMapping("/api/examples")
@Validated
public class ExampleController {
    private final ExampleService service;
    public ExampleController(ExampleService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "중립 예제 목록: 단순 조회는 JPA")
    // 프런트 URL page/size가 이 인수로 들어온다. 페이지 범위를 검증한 뒤 Service가 items/total을 함께 반환한다.
    public ExamplePage list(@RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.list(page, size);
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "예제 생성", responses = @ApiResponse(responseCode = "400", description = "입력 오류", content = @Content(schema = @Schema(implementation = ApiError.class))))
    public ExampleDto create(@Valid @RequestBody CreateExample input) { return service.create(input.title()); }

    @PutMapping("/{id}")
    @Operation(summary = "revision을 확인하여 예제 수정", responses = @ApiResponse(responseCode = "409", description = "낙관적 잠금 충돌", content = @Content(schema = @Schema(implementation = ApiError.class))))
    // 수정 요청의 revision은 사용자가 편집을 시작한 버전이다. 최신 버전으로 자동 보정하지 않고 Service 충돌 판단에 그대로 전달한다.
    public ExampleDto update(@PathVariable @Min(1) long id, @Valid @RequestBody UpdateExample input) {
        return service.update(id, input.title(), input.revision());
    }

    @GetMapping("/summary")
    @Operation(summary = "MyBatis 읽기 연결 예제")
    public ExampleService.ExampleSummary summary() { return service.summary(); }

    public record CreateExample(@NotBlank(message = "제목을 입력해 주세요.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title) {}
    // Integer로 누락 null과 실제 0을 구별한다. @NotNull/@Min 위반은 공통 필드 오류 JSON으로 변환된다.
    public record UpdateExample(@NotBlank(message = "제목을 입력해 주세요.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title,
            @NotNull(message = "revision을 전달해 주세요.") @Min(value = 1, message = "revision이 올바르지 않습니다.")
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Integer revision) {}
}
