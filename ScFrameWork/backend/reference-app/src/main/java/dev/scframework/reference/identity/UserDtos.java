package dev.scframework.reference.identity;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

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
