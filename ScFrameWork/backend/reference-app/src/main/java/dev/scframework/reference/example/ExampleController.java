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

@RestController
@RequestMapping("/api/examples")
@Validated
public class ExampleController {
    private final ExampleService service;
    public ExampleController(ExampleService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "중립 예제 목록: 단순 조회는 JPA")
    public ExamplePage list(@RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.list(page, size);
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "예제 생성", responses = @ApiResponse(responseCode = "400", description = "입력 오류", content = @Content(schema = @Schema(implementation = ApiError.class))))
    public ExampleDto create(@Valid @RequestBody CreateExample input) { return service.create(input.title()); }

    @PutMapping("/{id}")
    @Operation(summary = "revision을 확인하여 예제 수정", responses = @ApiResponse(responseCode = "409", description = "낙관적 잠금 충돌", content = @Content(schema = @Schema(implementation = ApiError.class))))
    public ExampleDto update(@PathVariable @Min(1) long id, @Valid @RequestBody UpdateExample input) {
        return service.update(id, input.title(), input.revision());
    }

    @GetMapping("/summary")
    @Operation(summary = "MyBatis 읽기 연결 예제")
    public ExampleService.ExampleSummary summary() { return service.summary(); }

    public record CreateExample(@NotBlank(message = "제목을 입력해 주세요.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title) {}
    public record UpdateExample(@NotBlank(message = "제목을 입력해 주세요.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title,
            @NotNull(message = "revision을 전달해 주세요.") @Min(value = 1, message = "revision이 올바르지 않습니다.")
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Integer revision) {}
}
