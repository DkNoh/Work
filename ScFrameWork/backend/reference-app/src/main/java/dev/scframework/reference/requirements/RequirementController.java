package dev.scframework.reference.requirements;

import dev.scframework.reference.identity.ActorResolver;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import static dev.scframework.reference.requirements.RequirementDtos.*;

@RestController
@RequestMapping("/api/requirements")
public class RequirementController {
    private final RequirementService requirements;
    private final ActorResolver actors;
    public RequirementController(RequirementService requirements, ActorResolver actors) { this.requirements = requirements; this.actors = actors; }
    @GetMapping
    public RequirementPage list(@RequestParam(defaultValue = "") String q, @RequestParam(required = false) Long menuId,
            @RequestParam(defaultValue = "") String status, @RequestParam(required = false) Long authorId,
            @RequestParam(required = false) Long screenVersionId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, Authentication authentication) {
        return requirements.list(q, menuId, status, authorId, screenVersionId, page, size, actors.require(authentication));
    }
    @GetMapping("/{id}") public RequirementDetail detail(@PathVariable long id, Authentication authentication) { return requirements.detail(id, actors.require(authentication)); }
    @PostMapping public RequirementDetail create(@Valid @RequestBody RequirementInput input, Authentication authentication) { return requirements.create(input, actors.require(authentication)); }
    @PutMapping("/{id}") public RequirementDetail update(@PathVariable long id, @Valid @RequestBody RequirementInput input, Authentication authentication) { return requirements.update(id, input, actors.require(authentication)); }
    @PostMapping("/{id}/submit") public RequirementDetail submit(@PathVariable long id, @Valid @RequestBody RevisionInput input, Authentication authentication) { return requirements.submit(id, input.revision(), actors.require(authentication)); }
    @PutMapping("/{id}/assignee") public RequirementDetail assign(@PathVariable long id, @Valid @RequestBody AssigneeInput input, Authentication authentication) { return requirements.assign(id, input, actors.require(authentication)); }
    @PutMapping("/{id}/review") public RequirementDetail review(@PathVariable long id, @Valid @RequestBody ReviewInput input, Authentication authentication) { return requirements.review(id, input, actors.require(authentication)); }
    @PostMapping("/{id}/agree") public RequirementDetail agree(@PathVariable long id, @Valid @RequestBody RevisionInput input, Authentication authentication) { return requirements.agree(id, input.revision(), actors.require(authentication)); }
    @PostMapping("/{id}/comments") public RequirementDetail comment(@PathVariable long id, @Valid @RequestBody CommentInput input, Authentication authentication) { return requirements.comment(id, input.body(), actors.require(authentication)); }
}
