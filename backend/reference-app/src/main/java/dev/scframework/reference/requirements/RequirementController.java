package dev.scframework.reference.requirements;

import dev.scframework.reference.identity.ActorResolver;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import static dev.scframework.reference.requirements.RequirementDtos.*;

/**
 * 요구사항 목록/상세/본문/검토/상태 변경을 각각 명시적 API로 노출한다.
 * 인증에서 현재 DB actor를 구한 뒤 Service에 전달하며 권한·revision·이력 기록은 Service에 집중한다.
 */

@RestController
@RequestMapping("/api/requirements")
public class RequirementController {
    private final RequirementService requirements;
    private final ActorResolver actors;
    public RequirementController(RequirementService requirements, ActorResolver actors) { this.requirements = requirements; this.actors = actors; }
    @GetMapping
    // 검색 query를 Service의 범위/공개 조건 검증으로 전달한다. actor는 항상 현재 DB에서 해석한다.
    public RequirementPage list(@RequestParam(defaultValue = "") String q, @RequestParam(required = false) Long menuId,
            @RequestParam(defaultValue = "") String status, @RequestParam(required = false) Long authorId,
            @RequestParam(required = false) Long screenVersionId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, Authentication authentication) {
        return requirements.list(q, menuId, status, authorId, screenVersionId, page, size, actors.require(authentication));
    }
    @GetMapping("/{id}") public RequirementDetail detail(@PathVariable long id, Authentication authentication) { return requirements.detail(id, actors.require(authentication)); }
    @PostMapping public RequirementDetail create(@Valid @RequestBody RequirementInput input, Authentication authentication) { return requirements.create(input, actors.require(authentication)); }
    // 본문 저장은 PUT, 제출/합의는 각각 상태 변경 명령이다. 하나의 범용 상태 수정 endpoint로 프런트에게 전이 권한을 넘기지 않는다.
    @PutMapping("/{id}") public RequirementDetail update(@PathVariable long id, @Valid @RequestBody RequirementInput input, Authentication authentication) { return requirements.update(id, input, actors.require(authentication)); }
    @PostMapping("/{id}/submit") public RequirementDetail submit(@PathVariable long id, @Valid @RequestBody RevisionInput input, Authentication authentication) { return requirements.submit(id, input.revision(), actors.require(authentication)); }
    @PutMapping("/{id}/assignee") public RequirementDetail assign(@PathVariable long id, @Valid @RequestBody AssigneeInput input, Authentication authentication) { return requirements.assign(id, input, actors.require(authentication)); }
    @PutMapping("/{id}/review") public RequirementDetail review(@PathVariable long id, @Valid @RequestBody ReviewInput input, Authentication authentication) { return requirements.review(id, input, actors.require(authentication)); }
    @PostMapping("/{id}/agree") public RequirementDetail agree(@PathVariable long id, @Valid @RequestBody RevisionInput input, Authentication authentication) { return requirements.agree(id, input.revision(), actors.require(authentication)); }
    // 댓글 입력에는 revision이 없다. 댓글 추가가 부모 본문의 편집 버전을 소모하지 않는 별도 계약이다.
    @PostMapping("/{id}/comments") public RequirementDetail comment(@PathVariable long id, @Valid @RequestBody CommentInput input, Authentication authentication) { return requirements.comment(id, input.body(), actors.require(authentication)); }
}
