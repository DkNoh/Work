package dev.scframework.reference.requirements;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.reference.identity.ActorResolver;
import dev.scframework.reference.identity.UserRepository;
import dev.scframework.reference.identity.UserService;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.OptimisticLockException;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import static dev.scframework.reference.requirements.RequirementDtos.*;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Import(RequirementIntegrationTest.FixedTime.class)
class RequirementIntegrationTest {
    private static final String PASSWORD = "synthetic-password-only-007";
    private static final Path TEMP = temporarySecret();
    private static final Instant FIXED = Instant.parse("2026-10-06T12:34:56.123456789Z");
    @DynamicPropertySource static void settings(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE", () -> TEMP.resolve("bootstrap.secret").toString());
        registry.add("SC_BOOTSTRAP_USERNAME", () -> "b");
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:requirements-" + TEMP.getFileName() + ";DB_CLOSE_DELAY=-1");
        registry.add("logging.file.name", () -> TEMP.resolve("synthetic.log").toString());
    }
    @TestConfiguration static class FixedTime { @Bean @Primary Clock testClock() { return Clock.fixed(FIXED, ZoneOffset.UTC); } }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired UserService userService;
    @Autowired PasswordEncoder encoder;
    @Autowired Environment environment;
    @Autowired RequirementService service;
    @Autowired RequirementRepository requests;
    @Autowired ActorResolver actors;
    @Autowired EntityManagerFactory factory;
    @Autowired PlatformTransactionManager transactionManager;
    private Session admin, alice, bob, carol;
    private long menuId, aliceId, bobId, carolId;

    @BeforeEach void syntheticFixtures() throws Exception {
        for (String table : List.of("requirement_history", "requirement_comment", "requirement_review", "requirement_entry", "menu_entry")) jdbc.update("DELETE FROM " + table);
        jdbc.update("DELETE FROM reference_user WHERE username <> ?", "b");
        admin = login("b");
        aliceId = createUser("alice", "작성자", "REQUESTER");
        bobId = createUser("bob", "검토자", "REVIEWER");
        carolId = createUser("carol", "다른 검토자", "REVIEWER");
        alice = login("alice"); bob = login("bob"); carol = login("carol");
        menuId = body(write(post("/api/menus"), admin, Map.of("name", "대상 메뉴", "sortOrder", 0)).andExpect(status().isOk())).get("id").asLong();
    }

    @Test void identityIsDatabaseBackedNumericAndBootstrapDoesNotResetExistingHash() throws Exception {
        JsonNode identity = body(mvc.perform(get("/api/auth/me").session(admin.session())).andExpect(status().isOk()));
        assertThat(keys(identity)).containsExactlyInAnyOrder("id", "username", "displayName", "role");
        assertThat(identity.get("id").isIntegralNumber()).isTrue(); assertThat(identity.get("username").asText()).isEqualTo("b");
        String oldHash = users.findByUsername("b").orElseThrow().getPasswordHash();
        assertThat(encoder.matches(PASSWORD, oldHash)).isTrue();
        Files.delete(TEMP.resolve("bootstrap.secret"));
        try { userService.bootstrap(environment); assertThat(users.findByUsername("b").orElseThrow().getPasswordHash().equals(oldHash)).isTrue(); }
        finally { createSecret(TEMP.resolve("bootstrap.secret")); }
        assertThat(users.findByUsername("b").orElseThrow().getUsername().length()).isEqualTo(1);
        write(post("/api/users"), admin, Map.of("username", "x", "displayName", "짧은 API 계정", "password", PASSWORD, "role", "REQUESTER")).andExpect(status().isBadRequest());
    }

    @Test void userAndMenuCreationRequireCurrentDatabaseAdminRoleAndKeepOriginalJson() throws Exception {
        write(post("/api/users"), alice, Map.of("username", "no-admin", "displayName", "거절", "password", PASSWORD, "role", "ADMIN")).andExpect(status().isForbidden());
        JsonNode list = body(mvc.perform(get("/api/users").session(alice.session())).andExpect(status().isOk()));
        assertThat(keys(list.get(0))).containsExactlyInAnyOrder("id", "username", "displayName", "role");
        write(post("/api/users"), admin, Map.of("username", "alice", "displayName", "중복", "password", PASSWORD, "role", "REQUESTER")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DATA_CONFLICT"));
        write(post("/api/users"), admin, Map.of("username", "short-pass", "displayName", "짧은 암호", "password", "short", "role", "REQUESTER")).andExpect(status().isBadRequest());
        write(post("/api/users"), admin, Map.of("username", "long-pass", "displayName", "UTF8", "password", "가".repeat(25), "role", "REQUESTER")).andExpect(status().isBadRequest());
        write(post("/api/menus"), alice, Map.of("name", "거절", "sortOrder", 0)).andExpect(status().isForbidden());
        JsonNode menu = body(mvc.perform(get("/api/menus").session(alice.session())).andExpect(status().isOk())).get(0);
        assertThat(keys(menu)).containsExactlyInAnyOrder("id", "parentId", "name", "sortOrder", "active");
        assertThat(menu.get("parentId").isNull()).isTrue(); assertThat(menu.get("active").asInt()).isEqualTo(1);
        jdbc.update("UPDATE reference_user SET role = 'REQUESTER' WHERE username = ?", "b");
        try { write(post("/api/menus"), admin, Map.of("name", "현재 권한 거절", "sortOrder", 0)).andExpect(status().isForbidden()); }
        finally { jdbc.update("UPDATE reference_user SET role = 'ADMIN' WHERE username = ?", "b"); }
    }

    @Test void createPreservesWhitespaceNullAndZeroOneAndSnapshotIsStringWithoutHistoryRecursion() throws Exception {
        Map<String, Object> input = input("  제목\n ", 1); input.put("desired", " 내용\n "); input.put("reason", " 이유 ");
        JsonNode created = create(input);
        assertThat(created.get("title").asText()).isEqualTo("  제목\n "); assertThat(created.get("desired").asText()).isEqualTo(" 내용\n ");
        assertThat(created.get("reason").asText()).isEqualTo(" 이유 "); assertThat(created.get("referenceText").asText()).isEmpty();
        assertThat(created.get("similar").asInt()).isZero(); assertThat(created.get("revision").asInt()).isEqualTo(1);
        for (String field : List.of("screenVersionId", "annotation", "screenVersion", "review", "assignedReviewerId", "assignedReviewerName", "ado")) assertThat(created.get(field).isNull()).as(field).isTrue();
        assertThat(created.get("attachments").isEmpty()).isTrue(); assertThat(created.get("comments").isEmpty()).isTrue();
        assertThat(created.get("createdAt").asText()).isEqualTo("2026-10-06T12:34:56.123456Z");
        JsonNode history = created.get("history").get(0);
        assertThat(history.get("beforeJson").isNull()).isTrue(); assertThat(history.get("afterJson").isTextual()).isTrue();
        JsonNode snapshot = json.readTree(history.get("afterJson").asText());
        assertThat(snapshot.get("revision").asInt()).isEqualTo(1); assertThat(snapshot.has("history")).isFalse(); assertThat(snapshot.has("comments")).isFalse(); assertThat(snapshot.has("screenVersion")).isFalse();
        assertThat(snapshot.has("annotation") && snapshot.has("review") && snapshot.has("ado") && snapshot.has("attachments")).isTrue();
        assertThat(body(mvc.perform(get("/api/requirements/" + created.get("id").asLong()).session(alice.session())).andExpect(status().isOk()))).isEqualTo(created);
    }

    @Test void inputValidationRejectsUnknownFieldsMissingRevisionAndUnsupportedImageContract() throws Exception {
        Map<String, Object> input = input("정상", 1);
        input.put("title", " "); write(post("/api/requirements"), alice, input).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("title"));
        input.put("title", "정상"); input.remove("revision"); write(post("/api/requirements"), alice, input).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("revision"));
        input.put("revision", 1); input.put("authorId", bobId); write(post("/api/requirements"), alice, input).andExpect(status().isBadRequest()); input.remove("authorId");
        input.put("similar", true); write(post("/api/requirements"), alice, input).andExpect(status().isBadRequest()); input.put("followParts", "  참고할 부분  ");
        input.put("screenVersionId", 1); write(post("/api/requirements"), alice, input).andExpect(status().isBadRequest()); input.put("screenVersionId", null);
        input.put("annotation", Map.of("x", 0, "y", 0, "width", 0.5, "height", 0.5)); write(post("/api/requirements"), alice, input).andExpect(status().isBadRequest());
        assertThat(requests.count()).isZero();
    }

    @Test void requiredAndLengthErrorsExposeActualFieldNamesAndRejectedWritesDoNotAllocateRequests() throws Exception {
        Map<String, Object> input = input(" ", 1); input.put("desired", "\n "); input.put("reason", " ");
        JsonNode invalid = body(write(post("/api/requirements"), alice, input).andExpect(status().isBadRequest()));
        Set<String> fields = new HashSet<>(); invalid.get("errors").forEach(error -> fields.add(error.get("field").asText()));
        assertThat(fields).contains("title", "desired", "reason");
        for (Map.Entry<String, Integer> limit : Map.of("title", 200, "desired", 20000, "reason", 10000, "referenceText", 10000, "followParts", 10000).entrySet()) {
            Map<String, Object> tooLong = input("길이 검사", 1); tooLong.put(limit.getKey(), "x".repeat(limit.getValue() + 1));
            JsonNode result = body(write(post("/api/requirements"), alice, tooLong).andExpect(status().isBadRequest()));
            assertThat(result.get("errors").toString()).contains("\"field\":\"" + limit.getKey() + "\"");
        }
        Map<String, Object> missingMenu = input("없는 메뉴", 1); missingMenu.put("menuId", 999999);
        write(post("/api/requirements"), alice, missingMenu).andExpect(status().isNotFound());
        assertThat(requests.count()).isZero();
    }

    @Test void listAndCountShareDraftVisibilityLiteralSearchAndStableTieOrdering() throws Exception {
        long first = create(input("literal%_\\ target", 1)).get("id").asLong();
        long second = create(input("literalXX target", 1)).get("id").asLong();
        mvc.perform(get("/api/requirements").session(bob.session())).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0)).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/requirements").session(admin.session()).param("size", "1")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.items[0].id").value(second));
        JsonNode page = body(mvc.perform(get("/api/requirements").session(alice.session()).param("q", "%_\\")).andExpect(status().isOk()));
        assertThat(page.get("total").asInt()).isEqualTo(1); assertThat(page.get("items").get(0).get("id").asLong()).isEqualTo(first);
        assertThat(page.get("items").get(0).has("history")).isFalse(); assertThat(page.get("items").get(0).has("review")).isFalse();
        write(post("/api/requirements/" + first + "/submit"), alice, Map.of("revision", 1)).andExpect(status().isOk());
        mvc.perform(get("/api/requirements").session(bob.session()).param("menuId", Long.toString(menuId)).param("authorId", Long.toString(aliceId)).param("status", "REQUESTED")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        mvc.perform(get("/api/requirements").session(bob.session()).param("screenVersionId", "123")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        for (String[] limit : List.of(new String[]{"page", "-1"}, new String[]{"page", "1000001"}, new String[]{"size", "0"}, new String[]{"size", "101"}, new String[]{"q", "q".repeat(201)})) mvc.perform(get("/api/requirements").session(alice.session()).param(limit[0], limit[1])).andExpect(status().isBadRequest());
    }

    @Test void composedFiltersKeepPrivateDraftsOutOfBothCountAndEveryPage() throws Exception {
        String title = "한글 %_\\ 조건";
        long publicId = create(input(title, 1)).get("id").asLong();
        write(post("/api/requirements/" + publicId + "/submit"), alice, Map.of("revision", 1)).andExpect(status().isOk());
        long ownDraft = create(input(title, 1)).get("id").asLong();
        write(post("/api/requirements"), bob, input(title, 1)).andExpect(status().isOk());
        long otherMenu = body(write(post("/api/menus"), admin, Map.of("name", "다른 메뉴", "sortOrder", 1)).andExpect(status().isOk())).get("id").asLong();
        Map<String, Object> elsewhere = input(title, 1); elsewhere.put("menuId", otherMenu); create(elsewhere);

        for (Session viewer : List.of(bob, carol)) {
            mvc.perform(filteredList(viewer).param("authorId", Long.toString(aliceId)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                    .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(publicId));
        }
        mvc.perform(filteredList(alice).param("authorId", Long.toString(bobId)).param("status", "DRAFT"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0)).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(filteredList(admin).param("authorId", Long.toString(aliceId)).param("status", "DRAFT"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].id").value(ownDraft));

        for (int page = 0; page < 3; page++) {
            JsonNode response = body(mvc.perform(filteredList(alice).param("authorId", Long.toString(aliceId))
                    .param("page", Integer.toString(page)).param("size", "1")).andExpect(status().isOk()));
            assertThat(response.get("total").asLong()).isEqualTo(2);
            assertThat(response.get("page").asInt()).isEqualTo(page); assertThat(response.get("size").asInt()).isEqualTo(1);
            assertThat(response.get("items").size()).isEqualTo(page < 2 ? 1 : 0);
            if (page < 2) assertThat(response.get("items").get(0).get("id").asLong()).isEqualTo(page == 0 ? ownDraft : publicId);
        }
    }

    @Test void literalSearchPreservesIndividualWildcardsQuotesKoreanAndWhitespace() throws Exception {
        Map<String, String> cases = new LinkedHashMap<>();
        cases.put("%", "percent%marker"); cases.put("_", "under_score"); cases.put("\\", "back\\slash");
        cases.put("  ", "  padded "); cases.put("' OR 1=1", "' OR 1=1 literal"); cases.put("한글", "한글 검색");
        create(input("percentXmarker plain target", 1));
        for (Map.Entry<String, String> entry : cases.entrySet()) {
            long id = create(input(entry.getValue(), 1)).get("id").asLong();
            mvc.perform(get("/api/requirements").session(alice.session()).param("q", entry.getKey()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                    .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(id));
        }
        mvc.perform(get("/api/requirements").session(alice.session()).param("q", "q".repeat(200)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
    }

    @Test void updatedTimeTakesPriorityOverIdAndEmptyMaximumPageRetainsActualCount() throws Exception {
        long first = create(input("먼저 생성", 1)).get("id").asLong();
        long second = create(input("나중 생성", 1)).get("id").asLong();
        // 합성 조회 자료만 시간 차이를 만들어 updatedAt 우선, id 보조 정렬을 구분한다.
        jdbc.update("UPDATE requirement_entry SET updated_at=CAST(? AS TIMESTAMP WITH TIME ZONE) WHERE id=?", FIXED.plusSeconds(1).toString(), first);
        mvc.perform(get("/api/requirements").session(alice.session()).param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.items[0].id").value(first));
        mvc.perform(get("/api/requirements").session(alice.session()).param("page", "1").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.items[0].id").value(second));
        mvc.perform(get("/api/requirements").session(alice.session()).param("page", "1000000").param("size", "100"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/requirements").session(alice.session()).param("status", "UNKNOWN"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0)).andExpect(jsonPath("$.items").isEmpty());
    }

    @Test void existingAdminSessionUsesCurrentDatabaseRoleForDynamicListVisibility() throws Exception {
        create(input("비공개 초안", 1));
        mvc.perform(get("/api/requirements").session(admin.session()).param("status", "DRAFT"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        jdbc.update("UPDATE reference_user SET role='REQUESTER' WHERE username='b'");
        try {
            mvc.perform(get("/api/requirements").session(admin.session()).param("status", "DRAFT"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0)).andExpect(jsonPath("$.items").isEmpty());
        } finally { jdbc.update("UPDATE reference_user SET role='ADMIN' WHERE username='b'"); }
    }

    @Test void authorAndPrivateDraftPermissionsDoNotGiveAdminAnOwnerOverride() throws Exception {
        long id = create(input("권한", 1)).get("id").asLong();
        mvc.perform(get("/api/requirements/" + id).session(bob.session())).andExpect(status().isForbidden());
        mvc.perform(get("/api/requirements/" + id).session(admin.session())).andExpect(status().isOk());
        write(put("/api/requirements/" + id), admin, input("관리자 수정 거절", 1)).andExpect(status().isForbidden());
        write(post("/api/requirements/" + id + "/submit"), admin, Map.of("revision", 1)).andExpect(status().isForbidden());
        write(post("/api/requirements/" + id + "/comments"), bob, Map.of("body", "비공개 댓글 거절")).andExpect(status().isForbidden());
        write(put("/api/requirements/" + id + "/assignee"), alice, Map.of("revision", 1, "reviewerId", aliceId)).andExpect(status().isBadRequest());
        JsonNode assigned = body(write(put("/api/requirements/" + id + "/assignee"), admin, Map.of("revision", 1, "reviewerId", bobId)).andExpect(status().isOk()));
        assertThat(assigned.get("revision").asInt()).isEqualTo(2); assertThat(assigned.get("status").asText()).isEqualTo("DRAFT");
        mvc.perform(get("/api/requirements/" + id).session(bob.session())).andExpect(status().isForbidden());
        write(put("/api/requirements/" + id + "/review"), bob, review(2, true, "POSSIBLE")).andExpect(status().isForbidden());
    }

    @Test void submittedAssignedReviewNeedsInfoResubmitAgreementAndEditKeepHistoryAndCurrentReview() throws Exception {
        long id = create(input("협업", 1)).get("id").asLong();
        body(write(put("/api/requirements/" + id + "/assignee"), alice, Map.of("revision", 1, "reviewerId", bobId)).andExpect(status().isOk()));
        write(post("/api/requirements/" + id + "/submit"), alice, Map.of("revision", 2)).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(3));
        write(put("/api/requirements/" + id + "/review"), carol, review(3, false, "POSSIBLE")).andExpect(status().isForbidden());
        write(put("/api/requirements/" + id + "/review"), admin, review(3, false, "POSSIBLE")).andExpect(status().isForbidden());
        JsonNode needs = body(write(put("/api/requirements/" + id + "/review"), bob, review(3, true, "POSSIBLE")).andExpect(status().isOk()));
        assertThat(needs.get("status").asText()).isEqualTo("NEEDS_INFO"); assertThat(needs.get("review").has("needsInfo")).isFalse();
        write(put("/api/requirements/" + id), alice, input("보완", 4)).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NEEDS_INFO")).andExpect(jsonPath("$.review.reviewerId").value(bobId));
        write(post("/api/requirements/" + id + "/submit"), alice, Map.of("revision", 5)).andExpect(status().isOk());
        write(put("/api/requirements/" + id + "/review"), bob, review(6, false, "POSSIBLE")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVIEWING"));
        write(post("/api/requirements/" + id + "/agree"), bob, Map.of("revision", 7)).andExpect(status().isForbidden());
        write(post("/api/requirements/" + id + "/agree"), alice, Map.of("revision", 7)).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("AGREED"));
        JsonNode edited = body(write(put("/api/requirements/" + id), alice, input("합의 후 변경", 8)).andExpect(status().isOk()));
        assertThat(edited.get("status").asText()).isEqualTo("REQUESTED"); assertThat(edited.get("revision").asInt()).isEqualTo(9);
        assertThat(edited.get("review").get("reviewerId").asLong()).isEqualTo(bobId);
        assertThat(edited.get("history").size()).isEqualTo(9);
        for (int index = 0; index < edited.get("history").size(); index++) assertThat(json.readTree(edited.get("history").get(index).get("afterJson").asText()).get("revision").asInt()).isEqualTo(9 - index);
    }

    @Test void assigneeSameIsNoOpButChangeDeletesCurrentReviewAndPreservesBeforeSnapshot() throws Exception {
        long id = readyForReview();
        JsonNode reviewed = body(write(put("/api/requirements/" + id + "/review"), bob, review(3, false, "CONDITIONAL")).andExpect(status().isOk()));
        JsonNode unchanged = body(write(put("/api/requirements/" + id + "/assignee"), alice, Map.of("revision", 4, "reviewerId", bobId)).andExpect(status().isOk()));
        assertThat(unchanged).isEqualTo(reviewed);
        write(put("/api/requirements/" + id + "/assignee"), alice, Map.of("revision", 3, "reviewerId", bobId)).andExpect(status().isConflict());
        JsonNode changed = body(write(put("/api/requirements/" + id + "/assignee"), admin, Map.of("revision", 4, "reviewerId", carolId)).andExpect(status().isOk()));
        assertThat(changed.get("review").isNull()).isTrue(); assertThat(changed.get("status").asText()).isEqualTo("REQUESTED");
        JsonNode row = changed.get("history").get(0); assertThat(row.get("action").asText()).isEqualTo("ASSIGN_REVIEWER");
        assertThat(json.readTree(row.get("beforeJson").asText()).get("review").get("reviewerId").asLong()).isEqualTo(bobId);
        assertThat(json.readTree(row.get("afterJson").asText()).get("review").isNull()).isTrue();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM requirement_review WHERE requirement_id = ?", Integer.class, id)).isZero();
        write(post("/api/requirements/" + id + "/agree"), alice, Map.of("revision", 5)).andExpect(status().isBadRequest());
        Map<String, Object> unassign = new HashMap<>(); unassign.put("revision", 5); unassign.put("reviewerId", null);
        write(put("/api/requirements/" + id + "/assignee"), alice, unassign).andExpect(status().isOk()).andExpect(jsonPath("$.assignedReviewerId").isEmpty());
    }

    @Test void agreementRequiresPossibleCurrentReviewerAndAllThreeScopeFields() throws Exception {
        long id = readyForReview();
        write(post("/api/requirements/" + id + "/agree"), alice, Map.of("revision", 3)).andExpect(status().isBadRequest());
        Map<String, Object> review = review(3, false, "MORE_INFO");
        write(put("/api/requirements/" + id + "/review"), bob, review).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVIEWING"));
        write(post("/api/requirements/" + id + "/agree"), alice, Map.of("revision", 4)).andExpect(status().isBadRequest());
        review.put("decision", "POSSIBLE"); review.put("revision", 4); review.put("exclusions", " ");
        write(put("/api/requirements/" + id + "/review"), bob, review).andExpect(status().isOk());
        write(post("/api/requirements/" + id + "/agree"), alice, Map.of("revision", 5)).andExpect(status().isBadRequest());
        review.put("revision", 5); review.put("exclusions", "없음"); review.put("conditions", "");
        write(put("/api/requirements/" + id + "/review"), bob, review).andExpect(status().isOk());
        write(post("/api/requirements/" + id + "/agree"), alice, Map.of("revision", 6)).andExpect(status().isOk());
    }

    @Test void reviewerAuthorsCannotReviewOwnRequestAndReviewInputValidatesWithoutChangingCurrentState() throws Exception {
        long self = body(write(post("/api/requirements"), bob, input("검토자 작성", 1)).andExpect(status().isOk())).get("id").asLong();
        write(post("/api/requirements/" + self + "/submit"), bob, Map.of("revision", 1)).andExpect(status().isOk());
        write(put("/api/requirements/" + self + "/review"), bob, review(2, false, "POSSIBLE")).andExpect(status().isBadRequest());
        write(post("/api/requirements/" + self + "/submit"), bob, Map.of("revision", 2)).andExpect(status().isBadRequest());
        long id = readyForReview();
        Map<String, Object> invalid = review(3, false, "NOT_A_DECISION");
        write(put("/api/requirements/" + id + "/review"), bob, invalid).andExpect(status().isBadRequest());
        invalid = review(3, false, "POSSIBLE"); invalid.remove("conditions");
        write(put("/api/requirements/" + id + "/review"), bob, invalid).andExpect(status().isBadRequest());
        invalid = review(3, false, "POSSIBLE"); invalid.put("estimate", "HUGE");
        write(put("/api/requirements/" + id + "/review"), bob, invalid).andExpect(status().isBadRequest());
        mvc.perform(get("/api/requirements/" + id).session(alice.session())).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(3)).andExpect(jsonPath("$.review").isEmpty());
        write(post("/api/requirements/" + id + "/comments"), alice, Map.of("body", " ")).andExpect(status().isBadRequest());
        write(post("/api/requirements/" + id + "/comments"), alice, Map.of("body", "x".repeat(10001))).andExpect(status().isBadRequest());
    }

    @Test void fixedClockAndIdenticalCommandsStillIncrementOnceWhileCommentsDoNot() throws Exception {
        long id = readyForReview();
        write(put("/api/requirements/" + id + "/review"), bob, review(3, false, "POSSIBLE")).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(4));
        JsonNode repeated = body(write(put("/api/requirements/" + id + "/review"), bob, review(4, false, "POSSIBLE")).andExpect(status().isOk()));
        assertThat(repeated.get("revision").asInt()).isEqualTo(5); assertThat(repeated.get("updatedAt").asText()).isEqualTo("2026-10-06T12:34:56.123456Z");
        JsonNode commented = body(write(post("/api/requirements/" + id + "/comments"), carol, Map.of("body", "  댓글\n ")).andExpect(status().isOk()));
        assertThat(commented.get("revision")).isEqualTo(repeated.get("revision")); assertThat(commented.get("updatedAt")).isEqualTo(repeated.get("updatedAt")); assertThat(commented.get("history")).isEqualTo(repeated.get("history"));
        assertThat(commented.get("comments").get(0).get("body").asText()).isEqualTo("  댓글\n ");
        write(post("/api/requirements/" + id + "/comments"), alice, Map.of("body", "second", "revision", 5)).andExpect(status().isBadRequest());
        JsonNode second = body(write(post("/api/requirements/" + id + "/comments"), alice, Map.of("body", "second")).andExpect(status().isOk()));
        assertThat(second.get("comments").get(1).get("id").asLong()).isGreaterThan(second.get("comments").get(0).get("id").asLong());
    }

    @Test void archivedMenuCanBeKeptOnExistingRequestButCannotReceiveNewOrMovedRequest() throws Exception {
        JsonNode created = create(input("메뉴 보관", 1)); long id = created.get("id").asLong();
        write(put("/api/menus/" + menuId), admin, Map.of("name", "보관", "sortOrder", 0, "active", false)).andExpect(status().isOk()).andExpect(jsonPath("$.active").value(0));
        write(post("/api/requirements"), alice, input("신규 거절", 1)).andExpect(status().isBadRequest());
        write(put("/api/requirements/" + id), alice, input("기존 유지", 1)).andExpect(status().isOk());
        write(post("/api/menus"), admin, Map.of("name", "보관 부모 거절", "parentId", menuId, "sortOrder", 1)).andExpect(status().isBadRequest());
        long active = body(write(post("/api/menus"), admin, Map.of("name", "활성", "sortOrder", 1)).andExpect(status().isOk())).get("id").asLong();
        Map<String, Object> moved = input("활성으로 이동", 2); moved.put("menuId", active);
        write(put("/api/requirements/" + id), alice, moved).andExpect(status().isOk());
        write(put("/api/requirements/" + id), alice, input("보관 이동 거절", 3)).andExpect(status().isBadRequest());
    }

    @Test void failedHistoryInsertRollsBackBodyVersionAndCurrentReview() throws Exception {
        long id = readyForReview();
        JsonNode before = body(write(put("/api/requirements/" + id + "/review"), bob, review(3, false, "POSSIBLE")).andExpect(status().isOk()));
        jdbc.execute("ALTER TABLE requirement_history ADD CONSTRAINT synthetic_history_failure CHECK (action <> 'EDIT')");
        try { write(put("/api/requirements/" + id), alice, input("rollback canary", 4)).andExpect(status().isConflict()); }
        finally { jdbc.execute("ALTER TABLE requirement_history DROP CONSTRAINT synthetic_history_failure"); }
        assertThat(body(mvc.perform(get("/api/requirements/" + id).session(alice.session())).andExpect(status().isOk()))).isEqualTo(before);
    }

    @Test void failedReviewHistoryRollsBackUpsertStatusAndRevisionTogether() throws Exception {
        long id = readyForReview();
        JsonNode before = body(write(put("/api/requirements/" + id + "/review"), bob, review(3, false, "POSSIBLE")).andExpect(status().isOk()));
        jdbc.execute("ALTER TABLE requirement_history ADD CONSTRAINT synthetic_review_failure CHECK (after_json NOT LIKE '%rollback-marker%')");
        try {
            Map<String, Object> failing = review(4, true, "MORE_INFO"); failing.put("rationale", "rollback-marker");
            write(put("/api/requirements/" + id + "/review"), bob, failing).andExpect(status().isConflict());
        } finally { jdbc.execute("ALTER TABLE requirement_history DROP CONSTRAINT synthetic_review_failure"); }
        assertThat(body(mvc.perform(get("/api/requirements/" + id).session(alice.session())).andExpect(status().isOk()))).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM requirement_review WHERE requirement_id = ?", Integer.class, id)).isEqualTo(1);
    }

    @Test void concurrentHttpEditsYieldOneSuccessOneConflictAndOneCommittedHistory() throws Exception {
        long id = create(input("race", 1)).get("id").asLong();
        ExecutorService workers = Executors.newFixedThreadPool(2); CountDownLatch start = new CountDownLatch(1);
        try {
            var first = workers.submit(() -> { start.await(10, TimeUnit.SECONDS); return write(put("/api/requirements/" + id), alice, input("first", 1)).andReturn().getResponse().getStatus(); });
            var second = workers.submit(() -> { start.await(10, TimeUnit.SECONDS); return write(put("/api/requirements/" + id), alice, input("second", 1)).andReturn().getResponse().getStatus(); });
            start.countDown(); assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 409);
        } finally { workers.shutdownNow(); assertThat(workers.awaitTermination(10, TimeUnit.SECONDS)).isTrue(); }
        JsonNode finalState = body(mvc.perform(get("/api/requirements/" + id).session(alice.session())).andExpect(status().isOk()));
        assertThat(finalState.get("revision").asInt()).isEqualTo(2); assertThat(finalState.get("title").asText()).isIn("first", "second"); assertThat(finalState.get("history").size()).isEqualTo(2);
    }

    @Test void concurrentFirstReviewUsesRequestCasBeforeReviewInsertAndReturnsRevisionConflict() throws Exception {
        long id = readyForReview(); ExecutorService workers = Executors.newFixedThreadPool(2); CountDownLatch start = new CountDownLatch(1);
        try {
            var first = workers.submit(() -> { start.await(10, TimeUnit.SECONDS); return reply(write(put("/api/requirements/" + id + "/review"), bob, review(3, false, "POSSIBLE"))); });
            var second = workers.submit(() -> { start.await(10, TimeUnit.SECONDS); return reply(write(put("/api/requirements/" + id + "/review"), bob, review(3, false, "CONDITIONAL"))); });
            start.countDown(); List<Reply> results = List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
            assertThat(results.stream().map(Reply::status).toList()).containsExactlyInAnyOrder(200, 409);
            assertThat(results.stream().filter(result -> result.status() == 409).findFirst().orElseThrow().code()).isEqualTo("REVISION_CONFLICT");
        } finally { workers.shutdownNow(); assertThat(workers.awaitTermination(10, TimeUnit.SECONDS)).isTrue(); }
        JsonNode saved = body(mvc.perform(get("/api/requirements/" + id).session(alice.session())).andExpect(status().isOk()));
        assertThat(saved.get("revision").asInt()).isEqualTo(4); assertThat(saved.get("history").size()).isEqualTo(4); assertThat(saved.get("review").get("decision").asText()).isIn("POSSIBLE", "CONDITIONAL");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM requirement_review WHERE requirement_id = ?", Integer.class, id)).isEqualTo(1);
    }

    @Test void twoRealEntityManagerTransactionsDetectRaceAfterBothReadSameRevision() throws Exception {
        long id = create(input("CAS original", 1)).get("id").asLong();
        try (var winner = factory.createEntityManager(); var loser = factory.createEntityManager()) {
            winner.getTransaction().begin(); loser.getTransaction().begin();
            RequirementEntity first = winner.find(RequirementEntity.class, id), second = loser.find(RequirementEntity.class, id);
            assertThat(first.revision).isEqualTo(second.revision).isEqualTo(1);
            first.title = "CAS winner"; first.changed(first.status, FIXED.truncatedTo(java.time.temporal.ChronoUnit.MICROS)); winner.flush(); winner.getTransaction().commit();
            second.title = "CAS loser"; second.changed(second.status, FIXED.truncatedTo(java.time.temporal.ChronoUnit.MICROS));
            assertThatThrownBy(loser::flush).isInstanceOf(OptimisticLockException.class);
            if (loser.getTransaction().isActive()) loser.getTransaction().rollback();
        }
        assertThat(requests.findById(id).orElseThrow().getTitle()).isEqualTo("CAS winner"); assertThat(requests.findById(id).orElseThrow().getRevision()).isEqualTo(2);
    }

    private long readyForReview() throws Exception {
        long id = create(input("검토 흐름", 1)).get("id").asLong();
        write(put("/api/requirements/" + id + "/assignee"), alice, Map.of("revision", 1, "reviewerId", bobId)).andExpect(status().isOk());
        write(post("/api/requirements/" + id + "/submit"), alice, Map.of("revision", 2)).andExpect(status().isOk()); return id;
    }
    private MockHttpServletRequestBuilder filteredList(Session session) {
        return get("/api/requirements").session(session.session()).param("q", "%_\\").param("menuId", Long.toString(menuId));
    }
    private long createUser(String username, String displayName, String role) throws Exception { return body(write(post("/api/users"), admin, Map.of("username", username, "displayName", displayName, "role", role, "password", PASSWORD)).andExpect(status().isOk())).get("id").asLong(); }
    private JsonNode create(Map<String, Object> input) throws Exception { return body(write(post("/api/requirements"), alice, input).andExpect(status().isOk())); }
    private Map<String, Object> input(String title, int revision) {
        Map<String, Object> input = new LinkedHashMap<>(); input.put("title", title); input.put("menuId", menuId); input.put("desired", "요청 내용"); input.put("reason", "업무 이유"); input.put("similar", false); input.put("revision", revision); return input;
    }
    private Map<String, Object> review(int revision, boolean needsInfo, String decision) { return new HashMap<>(Map.of("revision", revision, "decision", decision, "rationale", "판단 근거", "conditions", "", "scope", "반영", "exclusions", "없음", "acceptance", "완료", "estimate", "SMALL", "needsInfo", needsInfo)); }
    private org.springframework.test.web.servlet.ResultActions write(MockHttpServletRequestBuilder request, Session session, Object value) throws Exception { return mvc.perform(request.session(session.session()).header(session.header(), session.token()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(value))); }
    private JsonNode body(org.springframework.test.web.servlet.ResultActions result) throws Exception { return json.readTree(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)); }
    private Session login(String username) throws Exception {
        JsonNode before; var initial = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn(); before = json.readTree(initial.getResponse().getContentAsString());
        var authenticated = mvc.perform(post("/api/auth/login").session((MockHttpSession) initial.getRequest().getSession(false)).header(before.get("headerName").asText(), before.get("token").asText()).param("username", username).param("password", PASSWORD)).andExpect(status().isNoContent()).andReturn();
        MockHttpSession session = (MockHttpSession) authenticated.getRequest().getSession(false);
        JsonNode csrf = body(mvc.perform(get("/api/auth/csrf").session(session)).andExpect(status().isOk())); return new Session(session, csrf.get("headerName").asText(), csrf.get("token").asText());
    }
    private record Session(MockHttpSession session, String header, String token) {}
    private record Reply(int status, String code) {}
    private Reply reply(org.springframework.test.web.servlet.ResultActions result) throws Exception { var response = result.andReturn().getResponse(); return new Reply(response.getStatus(), json.readTree(response.getContentAsString(StandardCharsets.UTF_8)).path("code").asText()); }
    private static Set<String> keys(JsonNode node) { Set<String> keys = new HashSet<>(); node.fieldNames().forEachRemaining(keys::add); return keys; }
    private static Path temporarySecret() { try { Path directory = Files.createTempDirectory("sc-requirements-007-"); createSecret(directory.resolve("bootstrap.secret")); return directory; } catch (IOException exception) { throw new IllegalStateException("Could not prepare synthetic secret"); } }
    private static void createSecret(Path secret) throws IOException { Files.writeString(secret, PASSWORD); if (Files.getFileStore(secret).supportsFileAttributeView("posix")) Files.setPosixFilePermissions(secret, PosixFilePermissions.fromString("rw-------")); }
    @AfterAll static void removeSyntheticFiles() throws IOException { try (var paths = Files.walk(TEMP)) { for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path); } }
}
