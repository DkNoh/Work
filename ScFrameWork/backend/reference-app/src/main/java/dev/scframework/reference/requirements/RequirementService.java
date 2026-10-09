package dev.scframework.reference.requirements;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.ApiException;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditPublisher;
import dev.scframework.reference.identity.UserEntity;
import dev.scframework.reference.identity.UserRepository;
import dev.scframework.reference.menu.MenuService;
import dev.scframework.reference.menu.MenuRepository;
import dev.scframework.reference.media.MediaService;
import dev.scframework.reference.media.MediaService.PreparedMedia;
import dev.scframework.reference.media.MediaDtos.AdoInput;
import java.net.URI;
import jakarta.persistence.EntityManager;
import jakarta.persistence.OptimisticLockException;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static dev.scframework.reference.requirements.RequirementDtos.*;

/**
 * 요구사항 작성자 권한·검토 담당자·상태 전이·revision·변경 이력의 업무 트랜잭션 경계다.
 * 중앙 요구사항 @Version을 먼저 flush한 뒤 하위 검토/이미지/첨부를 변경해 경쟁 요청의 부분 반영을 막는다.
 * 프런트가 채널별로 보낸 기준 revision을 신뢰하지 않고 현재 DB 상태와 비교하며 실패는 전체 DML rollback으로 이어진다.
 */

@Service
public class RequirementService {
    private final RequirementRepository requirements;
    private final ReviewRepository reviews;
    private final CommentRepository comments;
    private final HistoryRepository history;
    private final UserRepository users;
    private final MenuService menus;
    private final MenuRepository menuRepository;
    private final EntityManager em;
    private final ObjectMapper json;
    private final Clock clock;
    private final SecurityAuditPublisher audit;
    private final RequirementQueryRepository queries;
    private final RequirementReadMapper mapper;
    private final MediaService media;
    public RequirementService(RequirementRepository requirements, ReviewRepository reviews, CommentRepository comments,
            HistoryRepository history, UserRepository users, MenuService menus, EntityManager em, ObjectMapper json,
            Clock clock, SecurityAuditPublisher audit, RequirementQueryRepository queries, RequirementReadMapper mapper,
            MenuRepository menuRepository, MediaService media) {
        this.requirements = requirements; this.reviews = reviews; this.comments = comments; this.history = history;
        this.users = users; this.menus = menus; this.em = em; this.json = json; this.clock = clock; this.audit = audit;
        this.queries = queries; this.mapper = mapper; this.menuRepository = menuRepository;
        this.media=media;
    }
    @Transactional(readOnly = true)
    // Controller의 조회 조건을 검증하고 Querydsl 목록/건수를 받는다. 현재 페이지에 필요한 메뉴/사용자 ID만 모아 이름을 두 번의 일괄 조회로 보완한다.
    public RequirementPage list(String q, Long menuId, String status, Long authorId, Long screenVersionId, int page, int size, UserEntity actor) {
        if (page < 0 || page > 1_000_000 || size < 1 || size > 100 || q.length() > 200) throw invalid("조회 범위를 확인하세요.");
        var result = queries.search(q, menuId, status, authorId, screenVersionId, page, size, actor);
        if (result.items().isEmpty()) return new RequirementPage(List.of(), result.total(), page, size);
        Set<Long> menuIds = new HashSet<>(); Set<Long> userIds = new HashSet<>();
        for (RequirementEntity row : result.items()) {
            menuIds.add(row.menuId); userIds.add(row.authorId);
            if (row.assignedReviewerId != null) userIds.add(row.assignedReviewerId);
        }
        Map<Long, String> menuNames = new HashMap<>(); Map<Long, String> userNames = new HashMap<>();
        menuRepository.findAllById(menuIds).forEach(row -> menuNames.put(row.getId(), row.getName()));
        users.findAllById(userIds).forEach(row -> userNames.put(row.getId(), row.getDisplayName()));
        // 목록에 필요한 이름만 두 번의 batch 조회로 읽는다. 상세·저장 snapshot의 업무 규칙은 기존 경로를 유지한다.
        return new RequirementPage(result.items().stream().map(row -> mapper.summary(row,
                requiredName(menuNames, row.menuId), requiredName(userNames, row.authorId),
                row.assignedReviewerId == null ? null : requiredName(userNames, row.assignedReviewerId))).toList(), result.total(), page, size);
    }
    @Transactional(readOnly = true)
    // 단건 읽기도 DRAFT 공개 범위를 검사한 뒤 DTO를 조립한다. URL ID를 안다는 이유만으로 초안에 접근할 수 없다.
    public RequirementDetail detail(long id, UserEntity actor) { RequirementEntity request = require(id); read(request, actor); return detail(request); }
    @Transactional
    // 입력 교차 규칙/활성 메뉴/이미지 버전을 확인한 뒤 부모 INSERT를 flush한다. 박스·업무 이력·감사 발행까지 같은 트랜잭션에 포함한다.
    public RequirementDetail create(RequirementInput input, UserEntity actor) {
        validateGeneral(input); menus.requireActive(input.menuId());
        if (input.screenVersionId()!=null) media.validateVersion(input.screenVersionId(),input.menuId(),true);
        RequirementEntity request = new RequirementEntity(input, actor.getId(), now());
        em.persist(request); flush();
        if (input.annotation()!=null) media.saveAnnotation(request.id,request.screenVersionId,input.annotation());
        record(request, "CREATE", null, actor); publish(request, "REQUIREMENT_CREATE", actor);
        return detail(request);
    }
    @Transactional
    // 작성자와 revision 검사 → 변경 전 snapshot → 본문/미디어 계약 확인 → 부모 revision flush → 박스 변경 → 이력/응답 순서다.
    // 이미지 버전 자체는 수정할 수 없고 검토/합의 후 본문이 바뀌면 재검토 상태로 돌린다.
    public RequirementDetail update(long id, RequirementInput input, UserEntity actor) {
        RequirementEntity request = require(id); owner(request, actor); revision(request, input.revision());
        var before = snapshot(request); validateSimilar(input);
        if (!Objects.equals(request.screenVersionId,input.screenVersionId())) throw invalid("이미지 버전을 변경할 수 없습니다.");
        if (request.screenVersionId==null && input.annotation()!=null) throw invalid("일반 요청에는 박스를 지정할 수 없습니다.");
        if (request.screenVersionId!=null) {
            media.validateVersion(request.screenVersionId,input.menuId(),false);
            if (input.annotation()!=null) input.annotation().validate();
        }
        if (!Objects.equals(request.menuId, input.menuId())) menus.requireActive(input.menuId());
        request.edit(input); request.changed(changedStatus(request.status), now()); flush();
        if (request.screenVersionId!=null) {
            if (input.annotation()==null) media.deleteAnnotation(id);else media.saveAnnotation(id,request.screenVersionId,input.annotation());
        }
        record(request, "EDIT", before, actor); publish(request, "REQUIREMENT_UPDATE", actor);
        return detail(request);
    }
    @Transactional
    // 작성자만 DRAFT/NEEDS_INFO에서 제출할 수 있다. 화면 요청은 박스가 있어야 제출 가능하며 부모 상태/revision과 이력을 함께 변경한다.
    public RequirementDetail submit(long id, int expectedRevision, UserEntity actor) {
        RequirementEntity request = require(id); owner(request, actor); revision(request, expectedRevision);
        if (!Set.of("DRAFT", "NEEDS_INFO").contains(request.status)) throw invalid("초안 또는 보완 필요 상태에서 검토를 요청하세요.");
        if (request.screenVersionId!=null && media.annotationFor(id)==null) throw invalid("화면 요청의 박스를 추가한 뒤 검토를 요청하세요.");
        var before = snapshot(request); request.changed("REQUESTED", now()); flush();
        record(request, "SUBMIT", before, actor); publish(request, "REQUIREMENT_SUBMIT", actor);
        return detail(request);
    }
    @Transactional
    // 작성자 또는 ADMIN만 지정한다. 검토 역할/자기 지정 금지와 revision을 검사하고 실제 담당자 변경일 때 이전 검토를 제거한다.
    // 부모 @Version flush를 먼저 성공시켜 경쟁에서 진 요청이 다른 담당자의 검토만 삭제하는 상황을 막는다.
    public RequirementDetail assign(long id, AssigneeInput input, UserEntity actor) {
        RequirementEntity request = require(id);
        if (!actor.isAdmin()) owner(request, actor);
        revision(request, input.revision());
        if (input.reviewerId() != null) {
            UserEntity assignee = users.findById(input.reviewerId()).orElseThrow(RequirementService::missing);
            if (!assignee.isReviewer()) throw invalid("검토자 또는 관리자 계정만 담당자로 지정할 수 있습니다.");
            if (Objects.equals(input.reviewerId(), request.authorId)) throw invalid("본인 요청은 다른 검토 담당자에게 지정하세요.");
        }
        if (Objects.equals(request.assignedReviewerId, input.reviewerId())) { read(request, actor); return detail(request); }
        var before = snapshot(request); request.assignedReviewerId = input.reviewerId();
        request.changed("DRAFT".equals(request.status) ? "DRAFT" : "REQUESTED", now()); flush();
        // 요청 CAS를 먼저 확보한 뒤 관계를 바꿔 경쟁자의 검토 삭제가 부분 반영되지 않게 한다.
        reviews.findById(id).ifPresent(reviews::delete); reviews.flush();
        record(request, "ASSIGN_REVIEWER", before, actor); publish(request, "REQUIREMENT_ASSIGN", actor);
        return detail(request);
    }
    @Transactional
    // 현재 지정 검토자만 본인이 아닌 요청을 검토한다. 최초 Review INSERT의 PK 경쟁보다 부모 revision 경쟁을 먼저 검사한다.
    public RequirementDetail review(long id, ReviewInput input, UserEntity actor) {
        if (!actor.isReviewer()) throw forbidden();
        RequirementEntity request = require(id); read(request, actor);
        if (Objects.equals(request.authorId, actor.getId())) throw invalid("본인 요청의 검토는 다른 검토자가 작성해야 합니다.");
        if (!Objects.equals(request.assignedReviewerId, actor.getId())) throw new ApiException(403, "FORBIDDEN", "지정된 검토 담당자만 검토를 수정할 수 있습니다.");
        revision(request, input.revision());
        if ("DRAFT".equals(request.status)) throw invalid("검토 요청 이후에 검토할 수 있습니다.");
        var before = snapshot(request); Instant now = now();
        // 최초 검토 INSERT의 PK 경쟁보다 요청 @Version 경쟁을 먼저 검사한다.
        request.changed(input.needsInfo() ? "NEEDS_INFO" : "REVIEWING", now); flush();
        ReviewEntity review = reviews.findById(id).orElse(null);
        if (review == null) { review = new ReviewEntity(id); review.update(input, actor.getId(), now); em.persist(review); }
        else review.update(input, actor.getId(), now);
        reviews.flush();
        record(request, "REVIEW", before, actor); publish(request, "REQUIREMENT_REVIEW", actor);
        return detail(request);
    }
    @Transactional
    // 작성자만 현재 담당자의 POSSIBLE/CONDITIONAL 검토에 합의한다. scope/exclusions/acceptance가 모두 채워진 경우에만 AGREED로 전이한다.
    public RequirementDetail agree(long id, int expectedRevision, UserEntity actor) {
        RequirementEntity request = require(id); owner(request, actor); revision(request, expectedRevision);
        ReviewEntity review = reviews.findById(id).orElse(null);
        if (!"REVIEWING".equals(request.status) || review == null || request.assignedReviewerId == null
                || !Objects.equals(review.reviewerId, request.assignedReviewerId)
                || !Set.of("POSSIBLE", "CONDITIONAL").contains(review.decision)) throw invalid("가능 또는 조건부 가능 검토 후에 합의할 수 있습니다.");
        if (review.scope.isBlank() || review.exclusions.isBlank() || review.acceptance.isBlank())
            throw invalid("검토자가 반영 범위·제외 범위·완료 기준을 모두 작성해야 합니다. 제외 범위가 없으면 '없음'으로 작성하세요.");
        var before = snapshot(request); request.changed("AGREED", now()); flush();
        record(request, "AGREE", before, actor); publish(request, "REQUIREMENT_AGREE", actor);
        return detail(request);
    }
    @Transactional
    // 읽기 권한이 있는 사용자의 댓글을 별도 INSERT한다. 본문 revision/updatedAt/업무 이력을 건드리지 않아 작성 중 본문과 불필요하게 충돌하지 않는다.
    public RequirementDetail comment(long id, String body, UserEntity actor) {
        RequirementEntity request = require(id); read(request, actor);
        comments.saveAndFlush(new CommentEntity(id, body, actor.getId(), now()));
        // 댓글은 별도 기록이며 요청 revision/updatedAt/변경 이력을 수정하지 않는다.
        publish(request, "REQUIREMENT_COMMENT", actor); return detail(request);
    }
    @Transactional
    // 박스 수정/삭제도 부모 요구사항의 작성자·revision을 먼저 확인한다. 이미지 자식의 독립 편집 기준을 부모 버전 경쟁으로 직렬화한다.
    public RequirementDetail annotation(long id,int expectedRevision,BoxInput box,UserEntity actor) {
        RequirementEntity request=require(id);owner(request,actor);revision(request,expectedRevision);
        if (request.screenVersionId==null) throw invalid("화면 버전이 없는 요청입니다.");
        if (box!=null) box.validate();var before=snapshot(request);
        request.changed(changedStatus(request.status),now());flush();
        if (box==null) media.deleteAnnotation(id);else media.saveAnnotation(id,request.screenVersionId,box);
        record(request,box==null?"ANNOTATION_DELETE":"ANNOTATION_EDIT",before,actor);publish(request,"REQUIREMENT_ANNOTATION",actor);return detail(request);
    }
    @Transactional(readOnly=true)
    // 큰 파일을 준비하기 전 빠른 권한/revision 검사다. 실제 저장까지 경쟁이 생길 수 있으므로 attachment에서도 반드시 같은 검사를 다시 한다.
    public void checkAttachment(long id,int expectedRevision,UserEntity actor) { RequirementEntity request=require(id);owner(request,actor);revision(request,expectedRevision); }
    @Transactional
    // 준비된 새 blob의 rollback 정리를 가장 먼저 등록한다. 부모 권한/CAS 실패나 이후 관계/이력 저장 실패 때 새 파일을 남기지 않기 위함이다.
    public RequirementDetail attachment(long id,int expectedRevision,PreparedMedia prepared,UserEntity actor) {
        media.trackRollback(prepared);RequirementEntity request=require(id);owner(request,actor);revision(request,expectedRevision);
        var before=snapshot(request);request.changed(changedStatus(request.status),now());flush();
        media.addAttachment(id,prepared,actor);record(request,"ATTACHMENT_ADD",before,actor);publish(request,"REQUIREMENT_ATTACHMENT_ADD",actor);return detail(request);
    }
    @Transactional
    // 부모 revision을 먼저 확보한 뒤 첨부 관계/파일 메타데이터를 삭제한다. 실제 기존 blob 삭제 시점은 MediaService의 commit 후 lifecycle에 맡긴다.
    public RequirementDetail deleteAttachment(long id,long attachmentId,int expectedRevision,UserEntity actor) {
        RequirementEntity request=require(id);owner(request,actor);revision(request,expectedRevision);
        var before=snapshot(request);request.changed(changedStatus(request.status),now());flush();
        media.removeAttachment(id,attachmentId);record(request,"ATTACHMENT_DELETE",before,actor);publish(request,"REQUIREMENT_ATTACHMENT_DELETE",actor);return detail(request);
    }
    @Transactional
    // 읽기 권한과 작성자/지정 담당자 조건, AGREED/ADO_LINKED 상태, revision을 검사한다.
    // URL은 http/https·host·userinfo 금지로 검증하며 실제 외부 ADO 서버로 사용자 cookie를 보내거나 연결 여부를 조회하지 않는다.
    public RequirementDetail ado(long id,AdoInput input,UserEntity actor) {
        RequirementEntity request=require(id);read(request,actor);
        if (!Objects.equals(request.assignedReviewerId,actor.getId())) owner(request,actor);
        revision(request,input.revision());
        if (!Set.of("AGREED","ADO_LINKED").contains(request.status)) throw invalid("합의 완료 후 ADO 티켓을 연결하세요.");
        try {
            URI uri=URI.create(input.url());
            if (!Set.of("http","https").contains(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null) throw new IllegalArgumentException();
        } catch (IllegalArgumentException exception) { throw invalid("유효한 HTTP 또는 HTTPS 티켓 URL을 입력하세요."); }
        var before=snapshot(request);request.changed("ADO_LINKED",now());flush();media.saveAdo(id,input,actor);
        record(request,"ADO_LINK",before,actor);publish(request,"REQUIREMENT_ADO_LINK",actor);return detail(request);
    }
    @Transactional(readOnly=true)
    // 동일 읽기 권한으로 현재 상세를 평문으로 조립한다. 첨부 화면 URL도 로그인 필요한 API 주소이며 공개 정적 파일로 복사하지 않는다.
    public String export(long id,UserEntity actor) {
        RequirementEntity request=require(id);read(request,actor);RequirementDetail detail=detail(request);
        StringBuilder out=new StringBuilder();
        String[][] fields={{"제목",detail.title()},{"대상 메뉴",detail.menuName()},{"검토 담당자",detail.assignedReviewerName()},
            {"요청 내용",detail.desired()},{"업무 이유",detail.reason()},{"참고 자료",detail.referenceText()},{"따라 할 부분",detail.followParts()}};
        for (String[] field:fields) out.append(field[0]).append('\n').append(Objects.toString(field[1],"")).append("\n\n");
        if (detail.screenVersion()!=null) out.append("참고 화면: ").append(media.screenNameFor(detail.screenVersion().id())).append(" / 버전 ").append(detail.screenVersion().version()).append(" / /api/files/").append(detail.screenVersion().fileId()).append(" (로그인 필요)\n\n");
        if (detail.review()!=null) { var review=detail.review();String[][] reviews={{"판단 근거",review.rationale()},{"검토 조건",review.conditions()},{"반영 범위",review.scope()},{"제외 범위",review.exclusions()},{"완료 기준",review.acceptance()}};for(String[] field:reviews)out.append(field[0]).append('\n').append(field[1]).append("\n\n"); }
        return out.append("요청 #").append(id).append(" · revision ").append(detail.revision()).append("\n검토 가능 판단은 착수·일정 약속이 아닙니다. ADO 등록 상태는 이 도구에서 검증하지 않습니다.").toString();
    }
    // 신규 화면 요청은 이미지 버전과 박스를 동시에 지정해야 한다. 일반 텍스트 요청은 둘 다 null이며 similar 추가 입력 규칙은 공통으로 확인한다.
    private void validateGeneral(RequirementInput input) {
        validateSimilar(input);
        if ((input.screenVersionId()==null)!=(input.annotation()==null)) throw invalid("이미지 버전과 박스를 함께 지정하세요.");
        if (input.annotation()!=null) input.annotation().validate();
    }
    private void validateSimilar(RequirementInput input) {
        if (input.similar() && (input.followParts() == null || input.followParts().isBlank())) throw invalid("다른 화면에서 따라 할 부분을 작성하세요.");
    }
    private RequirementEntity require(long id) { return requirements.findById(id).orElseThrow(RequirementService::missing); }
    // DRAFT는 작성자/ADMIN만 읽는다. 나머지 상태 공개 규칙은 목록 Querydsl/MyBatis 보고서에서도 같은 의미로 유지해야 한다.
    private void read(RequirementEntity request, UserEntity actor) { if ("DRAFT".equals(request.status) && !Objects.equals(request.authorId, actor.getId()) && !actor.isAdmin()) throw forbidden(); }
    private void owner(RequirementEntity request, UserEntity actor) { if (!Objects.equals(request.authorId, actor.getId())) throw forbidden(); }
    private void revision(RequirementEntity request, int expectedRevision) { if (request.revision != expectedRevision) throw conflict(); }
    // 본문/박스/첨부가 검토 결과의 근거를 바꾸면 REVIEWING/AGREED/ADO_LINKED를 REQUESTED로 되돌린다.
    private String changedStatus(String status) { return Set.of("AGREED", "ADO_LINKED", "REVIEWING").contains(status) ? "REQUESTED" : status; }
    // JPA SQL 실행 시점의 낙관적 잠금 예외도 사전 revision 불일치와 동일한 409로 매핑한다. flush 자체가 commit을 뜻하지 않는다.
    private void flush() {
        try { requirements.flush(); }
        catch (OptimisticLockingFailureException | OptimisticLockException exception) { throw conflict(); }
    }
    private RequirementSummary summary(RequirementEntity request) {
        return mapper.summary(request, menus.require(request.menuId).getName(), name(request.authorId), name(request.assignedReviewerId));
    }
    private String name(Long id) { return id == null ? null : users.findById(id).orElseThrow(RequirementService::missing).getDisplayName(); }
    private static String requiredName(Map<Long, String> names, Long id) {
        String name = names.get(id); if (name == null) throw missing(); return name;
    }
    private ReviewResponse reviewResponse(long id) {
        return reviews.findById(id).map(review -> mapper.review(review, name(review.reviewerId))).orElse(null);
    }
    // 상세 관계와 표시 이름을 조립하는 읽기 경로다. 목록의 배치 조회 최적화와 별개이므로 상세 호출을 목록 행마다 반복하지 않는다.
    private RequirementDetail detail(RequirementEntity request) {
        RequirementSummary base = summary(request);
        var commentRows = comments.findByRequirementIdOrderByIdAsc(request.id).stream().map(comment -> mapper.comment(comment, name(comment.authorId))).toList();
        var historyRows = history.findByRequirementIdOrderByIdDesc(request.id).stream().map(row -> mapper.history(row, name(row.actorId))).toList();
        return mapper.detail(base, reviewResponse(request.id), commentRows, historyRows,media.annotationFor(request.id),media.versionFor(request.screenVersionId),media.attachmentsFor(request.id),media.adoFor(request.id));
    }
    // 업무 이력용 현재 상태를 DTO 기반 JSON 맵으로 만든다. 내부 엔티티 필드나 비밀번호 해시를 직렬화하지 않는다.
    private Map<String, Object> snapshot(RequirementEntity request) {
        Map<String, Object> snapshot = json.convertValue(summary(request), json.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, Object.class));
        snapshot.put("annotation",media.annotationFor(request.id)); snapshot.put("review",reviewResponse(request.id)); snapshot.put("ado",media.adoFor(request.id)); snapshot.put("attachments",media.attachmentsFor(request.id));
        return snapshot;
    }
    // before/after 직렬화와 이력 INSERT도 본 명령 트랜잭션 안이다. 기록 생성이 실패하면 업무 변경도 함께 rollback하도록 예외를 전파한다.
    private void record(RequirementEntity request, String action, Map<String, Object> before, UserEntity actor) {
        try {
            String beforeJson = before == null ? null : json.writeValueAsString(before);
            String afterJson = json.writeValueAsString(snapshot(request));
            history.saveAndFlush(new HistoryEntity(request.id, action, beforeJson, afterJson, actor.getId(), now()));
        } catch (JsonProcessingException exception) { throw new IllegalStateException("Could not record requirement history"); }
    }
    // 보안 감사는 actor·행동·대상 ID만 발행한다. 저장 전후 본문 전체는 별도 업무 History에 두며 감사 sink에 복사하지 않는다.
    private void publish(RequirementEntity request, String action, UserEntity actor) {
        audit.publish(new SecurityAuditEvent(actor.getUsername(), actor.getId(), now(), action, "SUCCESS", "REQUIREMENT", request.id.toString(), null, null));
    }
    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MICROS); }
    private static ApiException invalid(String message) { return new ApiException(400, "INVALID_INPUT", message); }
    private static ApiException missing() { return new ApiException(404, "NOT_FOUND", "대상을 찾을 수 없습니다."); }
    private static ApiException forbidden() { return new ApiException(403, "FORBIDDEN", "이 작업을 수행할 권한이 없습니다."); }
    private static ApiException conflict() { return new ApiException(409, "REVISION_CONFLICT", "다른 변경이 먼저 저장되었습니다. 입력 내용을 복사한 뒤 재조회하세요."); }
}
