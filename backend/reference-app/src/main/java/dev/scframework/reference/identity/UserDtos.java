package dev.scframework.reference.identity;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/**
 * 사용자 공개 응답과 생성/비밀번호 변경 입력을 분리한다. 공개 응답에는 passwordHash와 비밀번호가 없다.
 * Bean Validation은 기본 모양을, UserService는 비밀번호 바이트 제한·관리자 권한·현재 암호 확인을 맡는다.
 */

public final class UserDtos {
    private UserDtos() {}
    @Schema(name = "UserResponse")
    public record UserResponse(
            @Schema(requiredMode = REQUIRED) long id,
            @Schema(requiredMode = REQUIRED) String username,
            @Schema(requiredMode = REQUIRED) String displayName,
            @Schema(requiredMode = REQUIRED, allowableValues = {"REQUESTER", "REVIEWER", "ADMIN"}) String role) {
        public static UserResponse from(UserEntity user) {
            return new UserResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getRole());
        }
    }
    @Schema(name = "NewUserInput")
    public record NewUserInput(
            @NotBlank @Pattern(regexp = "[A-Za-z0-9_.-]{3,60}") String username,
            @NotBlank @Size(max = 80) String displayName,
            @NotBlank String password,
            @NotNull @Pattern(regexp = "REQUESTER|REVIEWER|ADMIN") String role) {}

    @Schema(name = "PasswordInput")
    public record PasswordInput(@NotBlank String currentPassword, @NotBlank String newPassword) {}
}
