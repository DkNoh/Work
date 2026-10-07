package dev.scframework.reference.menu;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class MenuDtos {
    private MenuDtos() {}
    @Schema(name = "MenuResponse")
    public record MenuResponse(
            @Schema(requiredMode = REQUIRED) long id,
            @Schema(requiredMode = REQUIRED, nullable = true) Long parentId,
            @Schema(requiredMode = REQUIRED) String name,
            @Schema(requiredMode = REQUIRED) int sortOrder,
            @Schema(requiredMode = REQUIRED, allowableValues = {"0", "1"}) int active) {
        static MenuResponse from(MenuEntity menu) { return new MenuResponse(menu.getId(), menu.getParentId(), menu.getName(), menu.getSortOrder(), menu.getActive()); }
    }
    @Schema(name = "MenuInput")
    public record MenuInput(Long parentId, @NotBlank @Size(max = 120) String name, int sortOrder) {}
    @Schema(name = "MenuEditInput")
    public record MenuEditInput(@NotBlank @Size(max = 120) String name, int sortOrder, boolean active) {}
}
