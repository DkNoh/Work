package dev.scframework.reference.requirements;

import static org.assertj.core.api.Assertions.assertThat;
import static dev.scframework.reference.requirements.RequirementDtos.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

/** 실제 APT 구현으로 외부 읽기 DTO의 null·숫자·문자열·UTC 계약을 검사한다. */
class RequirementReadMapperTest {
    private final RequirementReadMapper mapper = Mappers.getMapper(RequirementReadMapper.class);
    private final ObjectMapper json = new ObjectMapper();
    private static final Instant CREATED = Instant.parse("2026-10-07T09:01:02.123456+09:00");

    @Test void summaryPreservesWhitespaceNumericFlagsAndNullableIdentity() throws Exception {
        RequirementEntity request = request(false);
        RequirementSummary summary = mapper.summary(request, "메뉴", "작성자", null);
        JsonNode response = json.valueToTree(summary);
        assertThat(summary.title()).isEqualTo("  입력 보존 %_\\  ");
        assertThat(summary.desired()).isEqualTo("  원하는 내용\n"); assertThat(summary.reason()).isEqualTo("  이유  ");
        assertThat(response.get("similar").isIntegralNumber()).isTrue(); assertThat(summary.similar()).isZero();
        assertThat(response.has("assignedReviewerId") && response.get("assignedReviewerId").isNull()).isTrue();
        assertThat(response.has("assignedReviewerName") && response.get("assignedReviewerName").isNull()).isTrue();
        assertThat(response.has("screenVersionId") && response.get("screenVersionId").isNull()).isTrue();
        assertThat(summary.createdAt()).isEqualTo("2026-10-07T00:01:02.123456Z");
        assertThat(summary.updatedAt()).isEqualTo(summary.createdAt());
        assertThat(response.has("commandSequence")).isFalse();
    }

    @Test void mapperKeepsAssignedIdsAndAllExistingStatusStringsWithoutInputWrites() {
        RequirementEntity request = request(true); request.assignedReviewerId = 5_000_000_002L;
        for (String status : List.of("DRAFT", "REQUESTED", "NEEDS_INFO", "REVIEWING", "AGREED", "ADO_LINKED")) {
            request.status = status;
            RequirementSummary summary = mapper.summary(request, "메뉴", "작성자", "담당자");
            assertThat(summary.status()).isEqualTo(status); assertThat(summary.similar()).isEqualTo(1);
            assertThat(summary.assignedReviewerId()).isEqualTo(5_000_000_002L);
            assertThat(summary.assignedReviewerName()).isEqualTo("담당자");
            assertThat(summary.revision()).isEqualTo(7); assertThat(request.getRevision()).isEqualTo(7);
            assertThat(request.getUpdatedAt()).isEqualTo(CREATED);
        }
    }

    @Test void absentOptionalDetailValuesStayNullAndCollectionsStayArrays() {
        RequirementSummary summary = mapper.summary(request(false), "메뉴", "작성자", null);
        RequirementDetail detail = mapper.detail(summary, null, List.of(), List.of());
        JsonNode response = json.valueToTree(detail);
        for (String field : List.of("annotation", "screenVersion", "review", "ado"))
            assertThat(response.has(field) && response.get(field).isNull()).isTrue();
        for (String field : List.of("comments", "history", "attachments"))
            assertThat(response.get(field).isArray() && response.get(field).isEmpty()).isTrue();
        assertThat(detail.id()).isEqualTo(summary.id()); assertThat(detail.menuName()).isEqualTo(summary.menuName());
        assertThat(detail.updatedAt()).isEqualTo(summary.updatedAt());
    }

    @Test void reviewReadPreservesDecisionAndUtcWithoutExposingCommandNeedsInfo() {
        ReviewEntity review = new ReviewEntity(5_000_000_001L);
        for (String decision : List.of("UNREVIEWED", "POSSIBLE", "CONDITIONAL", "MORE_INFO", "IMPOSSIBLE")) {
            review.update(new ReviewInput(7, decision, "  판단 근거  ", "조건", "범위", "제외", "기준", "LARGE", true),
                    5_000_000_002L, CREATED.plusSeconds(1));
            ReviewResponse response = mapper.review(review, "검토자");
            assertThat(response.decision()).isEqualTo(decision); assertThat(response.rationale()).isEqualTo("  판단 근거  ");
            assertThat(response.reviewerId()).isEqualTo(5_000_000_002L); assertThat(response.reviewerName()).isEqualTo("검토자");
            assertThat(response.estimate()).isEqualTo("LARGE"); assertThat(response.updatedAt()).isEqualTo("2026-10-07T00:01:03.123456Z");
            assertThat(json.valueToTree(response).has("needsInfo")).isFalse();
        }
    }

    @Test void commentAndHistoryRemainOrderedAndOpaqueSnapshotsRemainStrings() {
        CommentEntity comment = new CommentEntity(5_000_000_001L, "  댓글 보존\n", 5_000_000_003L, CREATED); comment.id = 1L;
        String snapshot = "{\"title\":\"한글 %_\\\\\",\"similar\":1,\"review\":null}";
        HistoryEntity old = new HistoryEntity(comment.requirementId, "CREATE", null, snapshot, comment.authorId, CREATED); old.id = 2L;
        HistoryEntity recent = new HistoryEntity(comment.requirementId, "EDIT", snapshot, snapshot, comment.authorId, CREATED.plusSeconds(1)); recent.id = 3L;
        CommentResponse commentDto = mapper.comment(comment, "댓글 작성자");
        HistoryResponse oldDto = mapper.history(old, "변경자"); HistoryResponse recentDto = mapper.history(recent, "변경자");
        RequirementDetail detail = mapper.detail(mapper.summary(request(true), "메뉴", "작성자", null), null,
                List.of(commentDto), List.of(recentDto, oldDto));
        assertThat(detail.comments().getFirst().body()).isEqualTo("  댓글 보존\n");
        assertThat(detail.history()).extracting(HistoryResponse::id).containsExactly(3L, 2L);
        JsonNode response = json.valueToTree(detail);
        assertThat(response.get("history").get(0).get("beforeJson").isTextual()).isTrue();
        assertThat(response.get("history").get(0).get("beforeJson").asText()).isEqualTo(snapshot);
        assertThat(response.get("history").get(1).get("beforeJson").isNull()).isTrue();
        assertThat(response.get("history").get(1).get("afterJson").asText()).isEqualTo(snapshot);
        assertThat(detail.comments().getFirst().createdAt()).isEqualTo("2026-10-07T00:01:02.123456Z");
        assertThat(detail.history().getFirst().createdAt()).isEqualTo("2026-10-07T00:01:03.123456Z");
    }

    private RequirementEntity request(boolean similar) {
        RequirementEntity request = new RequirementEntity(new RequirementInput("  입력 보존 %_\\  ", 11L,
                "  원하는 내용\n", "  이유  ", "  참조  ", similar, "따라 할 부분", null, null, 7),
                5_000_000_003L, CREATED);
        request.id = 5_000_000_001L; request.revision = 7;
        return request;
    }
}
