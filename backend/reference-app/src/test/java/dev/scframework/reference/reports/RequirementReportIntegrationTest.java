package dev.scframework.reference.reports;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.reference.identity.UserEntity;
import dev.scframework.reference.identity.UserRepository;
import dev.scframework.reference.requirements.RequirementDtos;
import dev.scframework.reference.requirements.RequirementService;
import jakarta.persistence.EntityManagerFactory;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.executor.parameter.ParameterHandler;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.scripting.defaults.DefaultParameterHandler;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.RowBounds;
import org.apache.ibatis.session.SqlSessionFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** 원본 자료를 사용하지 않는 H2/HTTP/실제 Mapper 검증. 시간 상한을 성능 SLA로 쓰지 않는다. */
@SpringBootTest
@ActiveProfiles("dev")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Import(RequirementReportIntegrationTest.ProbeConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class RequirementReportIntegrationTest {
    private static final String PASSWORD = "synthetic-report-only-password-009";
    private static final Path TEMP = temporarySecret();
    private static final Instant FIXED = Instant.parse("2026-10-06T12:34:56.123456Z");
    private static final String SQL_NAMESPACE = RequirementReportSqlMapper.class.getName() + ".";
    private static final List<String> STATES = List.of("DRAFT", "REQUESTED", "NEEDS_INFO", "REVIEWING", "AGREED", "ADO_LINKED");
    private static final long ALICE = 1001, BOB = 1002, REVIEWER = 1003, MENU = 2001;

    @DynamicPropertySource static void settings(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE", () -> TEMP.resolve("bootstrap.secret").toString());
        registry.add("SC_BOOTSTRAP_USERNAME", () -> "report-admin");
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:reports-" + TEMP.getFileName() + ";DB_CLOSE_DELAY=-1");
        registry.add("logging.file.name", () -> TEMP.resolve("synthetic.log").toString());
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");
        registry.add("spring.jpa.properties.hibernate.session.events.log", () -> "false");
        registry.add("logging.level.org.hibernate.stat", () -> "OFF");
        registry.add("logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener", () -> "OFF");
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    @Autowired UserRepository users;
    @Autowired RequirementReportService reports;
    @Autowired RequirementService requirements;
    @Autowired EntityManagerFactory emf;
    @Autowired PlatformTransactionManager transactions;
    @Autowired SqlSessionFactory sessions;
    @Autowired ReportProbe probe;
    private MockHttpSession adminSession, aliceSession, reviewerSession;
    private UserEntity admin, alice;

    @BeforeEach void syntheticFixtures() throws Exception {
        probe.reset();
        for (String table : List.of("requirement_history", "requirement_comment", "requirement_review", "requirement_entry", "menu_entry", "security_audit_event"))
            jdbc.update("DELETE FROM " + table);
        jdbc.update("DELETE FROM reference_user WHERE username <> ?", "report-admin");
        admin = users.findByUsername("report-admin").orElseThrow();
        insertUser(ALICE, "report-alice", "작성자 A", "REQUESTER");
        insertUser(BOB, "report-bob", "작성자 B", "REQUESTER");
        insertUser(REVIEWER, "report-reviewer", "검토 담당자", "REVIEWER");
        alice = users.findById(ALICE).orElseThrow();
        jdbc.update("INSERT INTO menu_entry(id,parent_id,name,sort_order,active) VALUES(?,NULL,?,0,1)", MENU, "합성 메뉴");
        jdbc.update("INSERT INTO menu_entry(id,parent_id,name,sort_order,active) VALUES(?,NULL,?,1,0)", MENU + 1, "보관 메뉴");
        for (int i = 0; i < 6; i++) insertRequirement(101 + i, i == 5 ? MENU + 1 : MENU,
                i == 0 ? "한글 %_\\ quote'  " : List.of("unused", "B", "A", "A", "E", "F").get(i),
                STATES.get(i), i % 2 == 0 ? ALICE : BOB, i < 2 ? null : REVIEWER, FIXED);
        insertRequirement(107, MENU, "타인 초안 %_\\", "DRAFT", BOB, null, FIXED);
        for (int i = 1; i <= 3; i++) insertComment(104, FIXED.plusSeconds(i + 2));
        insertComment(103, FIXED.plusSeconds(1));
        for (int i = 1; i <= 2; i++) insertComment(105, FIXED.plusSeconds(i + 6));
        for (int i = 0; i < 4; i++) insertHistory(104);
        insertHistory(102);
        insertHistory(105); insertHistory(105);
        jdbc.update("INSERT INTO requirement_review(requirement_id,decision,rationale,conditions,scope,exclusions,acceptance,estimate,reviewer_id,updated_at)"
                + " VALUES(?,'POSSIBLE','근거','','범위','없음','완료','SMALL',?,?)", 104, REVIEWER, FIXED);
        adminSession = login("report-admin"); aliceSession = login("report-alice"); reviewerSession = login("report-reviewer");
        probe.reset();
    }

    @Test void aggregateChildrenBeforeJoiningAndKeepNullableUtcAndPublicJsonContracts() throws Exception {
        JsonNode page = getReport(adminSession, Map.of());
        assertThat(keys(page)).containsExactlyInAnyOrder("items", "total", "page", "size", "stats");
        assertThat(page.path("total").asLong()).isEqualTo(7);
        assertThat(ids(page)).containsExactly(107L, 106L, 105L, 104L, 103L, 102L, 101L);
        assertStats(page, Map.of("DRAFT", 2L, "REQUESTED", 1L, "NEEDS_INFO", 1L, "REVIEWING", 1L, "AGREED", 1L, "ADO_LINKED", 1L, "unassigned", 3L));
        JsonNode joined = item(page, 104);
        assertThat(joined.path("commentCount").asLong()).isEqualTo(3);
        assertThat(joined.path("historyCount").asLong()).isEqualTo(4);
        assertThat(joined.path("lastCommentAt").asText()).isEqualTo(FIXED.plusSeconds(5).toString());
        assertThat(joined.path("reviewDecision").asText()).isEqualTo("POSSIBLE");
        assertThat(joined.path("assignedReviewerId").asLong()).isEqualTo(REVIEWER);
        assertThat(joined.path("assignedReviewerName").asText()).isEqualTo("검토 담당자");
        assertThat(joined.path("createdAt").asText()).isEqualTo(FIXED.toString());
        assertThat(keys(joined)).containsExactlyInAnyOrder("id", "menuId", "menuName", "title", "status", "revision", "authorId", "authorName",
                "assignedReviewerId", "assignedReviewerName", "createdAt", "updatedAt", "reviewDecision", "commentCount", "historyCount", "lastCommentAt");
        JsonNode empty = item(page, 101);
        for (String field : List.of("assignedReviewerId", "assignedReviewerName", "reviewDecision", "lastCommentAt"))
            assertThat(empty.get(field).isNull()).as(field).isTrue();
        assertThat(empty.path("commentCount").asLong()).isZero(); assertThat(empty.path("historyCount").asLong()).isZero();
        assertThat(empty.path("title").asText()).isEqualTo("한글 %_\\ quote'  ");
    }

    @Test void privateDraftIsExcludedFromRowsEveryStatAndMatchingSearchUsingCurrentDatabaseRole() throws Exception {
        mvc.perform(get("/api/reports/requirements")).andExpect(status().isUnauthorized());
        JsonNode alicePage = getReport(aliceSession, Map.of());
        assertThat(ids(alicePage)).doesNotContain(107L).contains(101L);
        assertStats(alicePage, Map.of("DRAFT", 1L, "REQUESTED", 1L, "NEEDS_INFO", 1L, "REVIEWING", 1L, "AGREED", 1L, "ADO_LINKED", 1L, "unassigned", 2L));
        JsonNode reviewerPage = getReport(reviewerSession, Map.of());
        assertThat(ids(reviewerPage)).doesNotContain(101L, 107L);
        assertThat(reviewerPage.path("stats").path("DRAFT").asLong()).isZero();
        assertThat(getReport(aliceSession, Map.of("q", "타인 초안")).path("total").asLong()).isZero();
        assertThat(getReport(aliceSession, Map.of("authorId", Long.toString(BOB), "status", "DRAFT")).path("total").asLong()).isZero();
        jdbc.update("UPDATE reference_user SET role='REQUESTER' WHERE id=?", admin.getId());
        try { assertThat(getReport(adminSession, Map.of()).path("total").asLong()).isEqualTo(5); }
        finally { jdbc.update("UPDATE reference_user SET role='ADMIN' WHERE id=?", admin.getId()); }
    }

    @Test void myBatisFiltersAndDefaultOrderingMatchQuerydslJpaIncludingLiteralSearchAndArchivedMenu() throws Exception {
        List<Map<String, String>> filters = List.of(Map.of(), Map.of("q", "%_\\"), Map.of("q", "quote'"), Map.of("q", "  "),
                Map.of("q", "' OR 1=1 --"), Map.of("menuId", Long.toString(MENU + 1)), Map.of("status", "DRAFT"),
                Map.of("status", "NO_SUCH_STATUS"), Map.of("authorId", Long.toString(BOB)), Map.of("screenVersionId", "77"),
                Map.of("q", "A", "menuId", Long.toString(MENU), "status", "REVIEWING", "authorId", Long.toString(BOB)),
                Map.of("page", "1", "size", "2"));
        for (MockHttpSession actor : List.of(adminSession, aliceSession, reviewerSession)) for (Map<String, String> filter : filters) {
            JsonNode report = getReport(actor, filter);
            JsonNode original = body(mvc.perform(parameters(get("/api/requirements").session(actor), filter)).andExpect(status().isOk()));
            assertThat(report.path("total")).as(filter.toString()).isEqualTo(original.path("total"));
            assertThat(ids(report)).isEqualTo(ids(original));
            for (JsonNode row : report.path("items")) {
                JsonNode before = item(original, row.path("id").asLong());
                for (String field : List.of("id", "menuId", "menuName", "title", "status", "revision", "authorId", "authorName",
                        "assignedReviewerId", "assignedReviewerName", "createdAt", "updatedAt"))
                    assertThat(row.get(field)).as(field).isEqualTo(before.get(field));
                assertThat(keys(before)).contains("desired", "reason", "referenceText", "similar", "followParts", "screenVersionId");
            }
            assertStatInvariant(report);
        }
    }

    @Test void everyAllowedSortRanksWholeResultBeforePagingWithStableIdsAndNullCommentsLast() throws Exception {
        List<OrderRow> expected = List.of(new OrderRow(101, "한글 %_\\ quote'  ", 0, 0, null), new OrderRow(102, "B", 0, 1, null),
                new OrderRow(103, "A", 1, 0, FIXED.plusSeconds(1)), new OrderRow(104, "A", 3, 4, FIXED.plusSeconds(5)),
                new OrderRow(105, "E", 2, 2, FIXED.plusSeconds(8)), new OrderRow(106, "F", 0, 0, null), new OrderRow(107, "타인 초안 %_\\", 0, 0, null));
        for (String sort : List.of("updatedAt", "title", "commentCount", "historyCount", "lastCommentAt")) for (String direction : List.of("asc", "desc")) {
            Comparator<OrderRow> comparator = switch (sort) {
                case "title" -> Comparator.comparing(OrderRow::title);
                case "commentCount" -> Comparator.comparingLong(OrderRow::comments);
                case "historyCount" -> Comparator.comparingLong(OrderRow::history);
                case "lastCommentAt" -> Comparator.comparing(OrderRow::lastComment, Comparator.nullsLast(direction.equals("asc") ? Comparator.<Instant>naturalOrder() : Comparator.<Instant>reverseOrder()));
                default -> (left, right) -> 0;
            };
            if (direction.equals("desc") && !sort.equals("lastCommentAt")) comparator = comparator.reversed();
            comparator = comparator.thenComparing(Comparator.comparingLong(OrderRow::id).reversed());
            List<Long> paged = new ArrayList<>();
            for (int page = 0; page < 4; page++) {
                JsonNode result = getReport(adminSession, Map.of("sort", sort, "direction", direction, "page", Integer.toString(page), "size", "2"));
                paged.addAll(ids(result)); assertStatInvariant(result); assertThat(result.path("total").asLong()).isEqualTo(7);
            }
            assertThat(paged).as(sort + " " + direction).containsExactlyElementsOf(expected.stream().sorted(comparator).map(OrderRow::id).toList());
        }
        assertThat(ids(getReport(adminSession, Map.of("sort", "title")))).isEqualTo(ids(getReport(adminSession, Map.of("sort", "title", "direction", "desc"))));
    }

    @Test void emptyAndOutOfRangePagesKeepWholeFilteredStatsAndValidateBoundariesAndSqlInjection() throws Exception {
        JsonNode beyond = getReport(adminSession, Map.of("page", "1000000", "size", "100"));
        assertThat(ids(beyond)).isEmpty(); assertThat(beyond.path("total").asLong()).isEqualTo(7); assertStatInvariant(beyond);
        JsonNode empty = getReport(adminSession, Map.of("q", "not found"));
        assertThat(ids(empty)).isEmpty(); assertThat(empty.path("total").asLong()).isZero(); assertStatInvariant(empty);
        for (Map<String, String> invalid : List.of(Map.of("page", "-1"), Map.of("page", "1000001"), Map.of("size", "0"), Map.of("size", "101"),
                Map.of("q", "x".repeat(201)), Map.of("sort", "id"), Map.of("sort", "title DESC; DROP TABLE requirement_entry"),
                Map.of("sort", "title", "direction", "DESC"), Map.of("sort", "title", "direction", "asc;--"), Map.of("direction", "asc")))
            mvc.perform(parameters(get("/api/reports/requirements").session(adminSession), invalid)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM requirement_entry", Long.class)).isEqualTo(7);
        mvc.perform(get("/api/reports/requirements").session(adminSession).param("page", "bad")).andExpect(status().isBadRequest());
    }

    @Test void pageAndStatsUseOneSerializableSnapshotWhileAnotherTransactionCommitsUpdatesAndPhantoms() throws Exception {
        clearRequests(); insertRequirement(301, MENU, "old snapshot", "REQUESTED", ALICE, null, FIXED);
        Barrier barrier = new Barrier(new CountDownLatch(1), new CountDownLatch(1)); probe.barrier.set(barrier);
        ExecutorService worker = Executors.newSingleThreadExecutor();
        try {
            Future<RequirementReportDtos.RequirementReportPage> read = worker.submit(() -> reports.report("", null, "REQUESTED", null, null, 0, 20, null, null, admin));
            assertThat(barrier.statsRead().await(20, TimeUnit.SECONDS)).isTrue();
            try {
                new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                    jdbc.update("UPDATE requirement_entry SET status='AGREED' WHERE id=301");
                    insertRequirement(302, MENU, "new phantom", "REQUESTED", ALICE, null, FIXED.plusSeconds(1));
                    insertComment(301, FIXED.plusSeconds(1));
                });
            } finally { barrier.writerCommitted().countDown(); }
            var snapshot = read.get(30, TimeUnit.SECONDS);
            assertThat(snapshot.total()).isEqualTo(1); assertThat(snapshot.stats().requested()).isEqualTo(1);
            assertThat(snapshot.items()).extracting(RequirementReportDtos.RequirementReportItem::id).containsExactly(301L);
            assertThat(snapshot.items().getFirst().status()).isEqualTo("REQUESTED"); assertThat(snapshot.items().getFirst().commentCount()).isZero();
            var after = reports.report("", null, "REQUESTED", null, null, 0, 20, null, null, admin);
            assertThat(after.items()).extracting(RequirementReportDtos.RequirementReportItem::id).containsExactly(302L);
            assertThat(probe.isolations).containsOnly(Connection.TRANSACTION_SERIALIZABLE);
            try (Connection connection = dataSource.getConnection()) { assertThat(connection.getTransactionIsolation()).isEqualTo(Connection.TRANSACTION_READ_COMMITTED); }
        } finally {
            barrier.writerCommitted().countDown(); probe.barrier.set(null); worker.shutdownNow(); assertThat(worker.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test void existingRequiredJpaWriteTransactionSharesFlushedRowsAndRollbackWithReportMapper() {
        long before = jdbc.queryForObject("SELECT COUNT(*) FROM requirement_entry", Long.class);
        assertThatThrownBy(() -> new TransactionTemplate(transactions).execute(tx -> {
            var created = requirements.create(new RequirementDtos.RequirementInput("mixed report rollback", MENU, "내용", "이유", "", false, "", null, null, 1), alice);
            var page = reports.report("mixed report rollback", null, "", null, null, 0, 20, null, null, alice);
            assertThat(page.total()).isEqualTo(1); assertThat(page.items().getFirst().id()).isEqualTo(created.id());
            assertThat(page.items().getFirst().historyCount()).isEqualTo(1);
            assertThat(probe.isolations).containsOnly(Connection.TRANSACTION_READ_COMMITTED);
            throw new SyntheticRollback();
        })).isInstanceOf(SyntheticRollback.class);
        assertThat(reports.report("mixed report rollback", null, "", null, null, 0, 20, null, null, alice).total()).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM requirement_entry", Long.class)).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE action='REQUIREMENT_CREATE' AND outcome='SUCCESS'", Long.class)).isZero();
    }

    @Test void reportAlwaysPreparesTwoBoundQueriesAndOriginalListBatchNamesAreBoundedForOneAndHundredDistinctRows() throws Exception {
        clearRequests();
        for (int i = 1; i <= 100; i++) {
            insertUser(400_000 + i, "batch-author-" + i, "작성자 " + i, "REQUESTER");
            insertUser(500_000 + i, "batch-reviewer-" + i, "검토자 " + i, "REVIEWER");
            jdbc.update("INSERT INTO menu_entry(id,parent_id,name,sort_order,active) VALUES(?,NULL,?,0,1)", 300_000 + i, "메뉴 " + i);
            insertRequirement(600_000 + i, 300_000 + i, "batch " + i, "REQUESTED", 400_000 + i, 500_000L + i, FIXED);
        }
        var statistics = emf.unwrap(SessionFactory.class).getStatistics();
        List<Long> originalStatements = new ArrayList<>();
        for (int size : List.of(1, 100)) {
            statistics.clear();
            JsonNode original = body(mvc.perform(get("/api/requirements").session(adminSession).param("size", Integer.toString(size))).andExpect(status().isOk()));
            originalStatements.add(statistics.getPrepareStatementCount());
            assertThat(original.path("items").size()).isEqualTo(size);
            for (JsonNode row : original.path("items")) {
                long ordinal = row.path("id").asLong() - 600_000;
                assertThat(row.path("menuName").asText()).isEqualTo("메뉴 " + ordinal);
                assertThat(row.path("authorName").asText()).isEqualTo("작성자 " + ordinal);
                assertThat(row.path("assignedReviewerName").asText()).isEqualTo("검토자 " + ordinal);
            }
            probe.reset(); JsonNode page = getReport(adminSession, Map.of("size", Integer.toString(size)));
            assertThat(page.path("items").size()).isEqualTo(size); assertThat(probe.prepared).hasSize(2);
        }
        // 현재 DB actor 조회 1 + Querydsl count/page 2 + 메뉴/계정 batch 2. 100개의 서로 다른 이름에도 일정하다.
        assertThat(originalStatements).containsExactly(5L, 5L);
        statistics.clear();
        mvc.perform(get("/api/requirements").session(adminSession).param("q", "absent")).andExpect(status().isOk());
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(3);
        writeEvidence("bounded-queries.json", Map.of("rows", List.of(1, 100), "jpaStatementsIncludingActor", originalStatements,
                "mybatisReportStatements", 2, "emptyJpaStatementsIncludingActor", 3));
    }

    @Test void actualSwaggerDocumentsOperationRequiredSevenStatsNumericCountsAndNullableUtcValues() throws Exception {
        JsonNode api = body(mvc.perform(get("/v3/api-docs").session(adminSession)).andExpect(status().isOk()));
        assertThat(api.at("/paths/~1api~1reports~1requirements/get/operationId").asText()).isEqualTo("requirementReport");
        JsonNode parameters = api.at("/paths/~1api~1reports~1requirements/get/parameters");
        for (String name : List.of("page", "size")) {
            JsonNode parameter = null;
            for (JsonNode candidate : parameters) if (candidate.path("name").asText().equals(name)) parameter = candidate;
            assertThat(parameter).as(name + " query parameter").isNotNull();
            assertThat(parameter.path("in").asText()).isEqualTo("query");
            assertThat(parameter.path("required").asBoolean()).isFalse();
            JsonNode schema = parameter.path("schema");
            assertThat(schema.path("type").asText()).as(name + " type").isEqualTo("integer");
            assertThat(schema.path("format").asText()).isEqualTo("int32");
            for (String constraint : List.of("minimum", "maximum", "default"))
                assertThat(schema.path(constraint).isIntegralNumber()).as(name + " " + constraint + " numeric value").isTrue();
            assertThat(schema.path("minimum").asInt()).isEqualTo(name.equals("page") ? 0 : 1);
            assertThat(schema.path("maximum").asInt()).isEqualTo(name.equals("page") ? 1_000_000 : 100);
            assertThat(schema.path("default").asInt()).isEqualTo(name.equals("page") ? 0 : 20);
        }
        JsonNode item = api.at("/components/schemas/RequirementReportItem");
        for (String name : List.of("commentCount", "historyCount")) {
            assertThat(item.path("properties").path(name).path("type").asText()).isEqualTo("integer");
            assertThat(item.path("required").toString()).contains("\"" + name + "\"");
        }
        for (String name : List.of("assignedReviewerId", "assignedReviewerName", "lastCommentAt"))
            assertThat(item.path("properties").path(name).path("type").toString()).as(name).contains("null");
        JsonNode decision = item.path("properties").path("reviewDecision").path("anyOf");
        assertThat(decision.size()).isEqualTo(2);
        assertThat(decision.get(0).path("type").asText()).isEqualTo("string");
        assertThat(decision.get(0).path("enum").toString()).contains("UNREVIEWED", "POSSIBLE", "CONDITIONAL", "MORE_INFO", "IMPOSSIBLE");
        assertThat(decision.get(1).path("type").asText()).isEqualTo("null");
        assertThat(item.path("properties").path("lastCommentAt").path("format").asText()).isEqualTo("date-time");
        JsonNode stats = api.at("/components/schemas/RequirementReportStats");
        assertThat(keys(stats.path("properties"))).containsExactlyInAnyOrder("DRAFT", "REQUESTED", "NEEDS_INFO", "REVIEWING", "AGREED", "ADO_LINKED", "unassigned");
        assertThat(stats.path("required").size()).isEqualTo(7);
    }

    @Test void syntheticTenThousandRowsProvePageCountVisibilityAggregationAndRecordRealExplainMeasurements() throws Exception {
        clearRequests();
        long seedStart = System.nanoTime();
        List<Object[]> rows = new ArrayList<>();
        for (int i = 1; i <= 10_000; i++) {
            String state = STATES.get(i % 6);
            long author = i % 2 == 0 ? ALICE : BOB;
            rows.add(new Object[]{1_000_000L + i, i % 3 == 0 ? MENU + 1 : MENU, "합성 " + i + (i % 100 == 0 ? " %_\\" : ""),
                    state, author, i % 4 == 0 ? null : REVIEWER, FIXED.plusSeconds(i / 3)});
        }
        jdbc.batchUpdate("INSERT INTO requirement_entry(id,menu_id,title,desired,reason,reference_text,similar,follow_parts,screen_version_id,status,revision,command_sequence,author_id,assigned_reviewer_id,created_at,updated_at)"
                + " VALUES(?,?,?,'합성 내용','합성 이유','',0,'',NULL,?,1,0,?,?,?,?)",
                rows.stream().map(row -> new Object[]{row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[6]}).toList());
        jdbc.update("INSERT INTO requirement_comment(requirement_id,body,author_id,created_at) SELECT id,'합성 댓글',author_id,updated_at FROM requirement_entry WHERE MOD(id,3)=0");
        jdbc.update("INSERT INTO requirement_comment(requirement_id,body,author_id,created_at) SELECT id,'두 번째 합성 댓글',author_id,updated_at FROM requirement_entry WHERE MOD(id,6)=0");
        jdbc.update("INSERT INTO requirement_history(requirement_id,action,before_json,after_json,actor_id,created_at) SELECT id,'SYNTHETIC',NULL,'{}',author_id,updated_at FROM requirement_entry");
        jdbc.execute("ANALYZE");
        double seedMs = elapsedMs(seedStart);
        List<Map<String, Object>> measurements = new ArrayList<>();
        for (int pageNumber : List.of(0, 49, 99)) {
            probe.reset(); long start = System.nanoTime();
            var page = reports.report("", null, "", null, null, pageNumber, 100, null, null, admin);
            double duration = elapsedMs(start);
            assertThat(page.total()).isEqualTo(10_000); assertThat(page.items()).hasSize(100); assertThat(probe.prepared).hasSize(2);
            List<Long> expectedIds = jdbc.queryForList("SELECT id FROM requirement_entry ORDER BY updated_at DESC,id DESC LIMIT 100 OFFSET ?", Long.class, pageNumber * 100);
            assertThat(page.items()).extracting(RequirementReportDtos.RequirementReportItem::id).containsExactlyElementsOf(expectedIds);
            for (var row : page.items()) {
                assertThat(row.historyCount()).isEqualTo(1);
                assertThat(row.commentCount()).isEqualTo((row.id() % 3 == 0 ? 1 : 0) + (row.id() % 6 == 0 ? 1 : 0));
            }
            measurements.add(Map.of("page", pageNumber, "size", 100, "total", page.total(), "mybatisPreparedStatements", probe.prepared.size(), "elapsedMs", duration));
        }
        long expectedVisible = jdbc.queryForObject("SELECT COUNT(*) FROM requirement_entry WHERE status<>'DRAFT' OR author_id=?", Long.class, ALICE);
        var visible = reports.report("", null, "", null, null, 0, 100, null, null, alice);
        assertThat(visible.total()).isEqualTo(expectedVisible);
        // DRAFT 분포가 한 작성자에 치우치지 않도록 별도의 타인 초안도 검사한다.
        jdbc.update("UPDATE requirement_entry SET author_id=? WHERE status='DRAFT' AND MOD(id-1000000,12)=0", BOB);
        expectedVisible = jdbc.queryForObject("SELECT COUNT(*) FROM requirement_entry WHERE status<>'DRAFT' OR author_id=?", Long.class, ALICE);
        assertThat(reports.report("", null, "", null, null, 0, 100, null, null, alice).total()).isEqualTo(expectedVisible).isLessThan(10_000);
        var literal = reports.report("%_\\", null, "", null, null, 0, 100, null, null, admin);
        assertThat(literal.total()).isEqualTo(100); assertThat(literal.items()).hasSize(100);
        var criteria = RequirementReportService.criteria("", MENU, "", null, null, 0, 100, "commentCount", "desc", admin);
        Map<String, String> plans = new LinkedHashMap<>();
        plans.put("pageFilteredAggregate", explain("selectPage", criteria));
        plans.put("statsFiltered", explain("selectStats", criteria));
        plans.put("pageDefault", explain("selectPage", RequirementReportService.criteria("", null, "", null, null, 0, 100, null, null, admin)));
        assertThat(plans.values()).allSatisfy(plan -> { assertThat(plan).containsIgnoringCase("scanCount"); assertThat(plan).contains("REQUIREMENT_ENTRY"); });
        writeEvidence("explain-plans.json", plans);
        try (Connection connection = dataSource.getConnection()) {
            writeEvidence("performance-10000.json", Map.of("rows", 10_000, "source", "isolated synthetic H2 only", "seedMs", seedMs,
                    "jdk", System.getProperty("java.version"), "h2", connection.getMetaData().getDatabaseProductVersion(),
                    "isolation", "SERIALIZABLE for independent report reads", "measurements", measurements,
                    "timingPolicy", "observations, no hardcoded latency SLA", "indexes", jdbc.queryForList("SELECT INDEX_NAME FROM INFORMATION_SCHEMA.INDEXES WHERE TABLE_SCHEMA='PUBLIC' ORDER BY INDEX_NAME", String.class)));
        }
    }

    private String explain(String statementName, RequirementReportRows.Criteria criteria) throws Exception {
        MappedStatement statement = sessions.getConfiguration().getMappedStatement(SQL_NAMESPACE + statementName);
        BoundSql sql = statement.getBoundSql(criteria);
        try (Connection connection = dataSource.getConnection(); PreparedStatement query = connection.prepareStatement("EXPLAIN ANALYZE " + sql.getSql())) {
            ParameterHandler handler = new DefaultParameterHandler(statement, criteria, sql); handler.setParameters(query);
            try (var result = query.executeQuery()) { assertThat(result.next()).isTrue(); return result.getString(1); }
        }
    }

    private void writeEvidence(String name, Object value) throws IOException {
        Path evidence = Path.of("target", "report-evidence"); Files.createDirectories(evidence);
        json.writerWithDefaultPrettyPrinter().writeValue(evidence.resolve(name).toFile(), value);
    }
    private static double elapsedMs(long start) { return (System.nanoTime() - start) / 1_000_000.0; }
    private void insertUser(long id, String username, String displayName, String role) {
        jdbc.update("INSERT INTO reference_user(id,username,display_name,password_hash,role,created_at) SELECT ?,?,?,password_hash,?,? FROM reference_user WHERE id=?",
                id, username, displayName, role, FIXED, admin.getId());
    }
    private void insertRequirement(long id, long menuId, String title, String status, long author, Long assigned, Instant time) {
        jdbc.update("INSERT INTO requirement_entry(id,menu_id,title,desired,reason,reference_text,similar,follow_parts,screen_version_id,status,revision,command_sequence,author_id,assigned_reviewer_id,created_at,updated_at)"
                + " VALUES(?,?,?,'합성 내용','합성 이유','',0,'',NULL,?,1,0,?,?,?,?)", id, menuId, title, status, author, assigned, time, time);
    }
    private void insertComment(long requirementId, Instant created) { jdbc.update("INSERT INTO requirement_comment(requirement_id,body,author_id,created_at) VALUES(?,'합성 댓글',?,?)", requirementId, ALICE, created); }
    private void insertHistory(long requirementId) { jdbc.update("INSERT INTO requirement_history(requirement_id,action,before_json,after_json,actor_id,created_at) VALUES(?,'SYNTHETIC',NULL,'{}',?,?)", requirementId, ALICE, FIXED); }
    private void clearRequests() { for (String table : List.of("requirement_history", "requirement_comment", "requirement_review", "requirement_entry")) jdbc.update("DELETE FROM " + table); }
    private JsonNode getReport(MockHttpSession session, Map<String, String> params) throws Exception {
        return body(mvc.perform(parameters(get("/api/reports/requirements").session(session), params)).andExpect(status().isOk()));
    }
    private MockHttpServletRequestBuilder parameters(MockHttpServletRequestBuilder request, Map<String, String> params) { params.forEach(request::param); return request; }
    private JsonNode body(org.springframework.test.web.servlet.ResultActions result) throws Exception { return json.readTree(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)); }
    private MockHttpSession login(String username) throws Exception {
        var before = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        JsonNode csrf = json.readTree(before.getResponse().getContentAsString());
        var logged = mvc.perform(post("/api/auth/login").session((MockHttpSession) before.getRequest().getSession(false))
                .header(csrf.path("headerName").asText(), csrf.path("token").asText()).param("username", username).param("password", PASSWORD))
                .andExpect(status().isNoContent()).andReturn();
        return (MockHttpSession) logged.getRequest().getSession(false);
    }
    private static Set<String> keys(JsonNode node) { Set<String> result = new HashSet<>(); node.fieldNames().forEachRemaining(result::add); return result; }
    private static List<Long> ids(JsonNode page) { List<Long> ids = new ArrayList<>(); page.path("items").forEach(row -> ids.add(row.path("id").asLong())); return ids; }
    private static JsonNode item(JsonNode page, long id) { for (JsonNode row : page.path("items")) if (row.path("id").asLong() == id) return row; throw new AssertionError("Expected report row " + id); }
    private static void assertStats(JsonNode page, Map<String, Long> expected) {
        assertThat(keys(page.path("stats"))).containsExactlyInAnyOrderElementsOf(expected.keySet());
        expected.forEach((key, count) -> assertThat(page.path("stats").path(key).asLong()).as(key).isEqualTo(count)); assertStatInvariant(page);
    }
    private static void assertStatInvariant(JsonNode page) {
        long sum = 0; for (String state : STATES) { long count = page.path("stats").path(state).asLong(); assertThat(count).isNotNegative(); sum += count; }
        assertThat(sum).isEqualTo(page.path("total").asLong());
        assertThat(page.path("stats").path("unassigned").asLong()).isBetween(0L, sum);
    }
    private record OrderRow(long id, String title, long comments, long history, Instant lastComment) {}
    private record Barrier(CountDownLatch statsRead, CountDownLatch writerCommitted) {}
    private static final class SyntheticRollback extends RuntimeException {}

    @TestConfiguration(proxyBeanMethods = false)
    static class ProbeConfiguration { @Bean ReportProbe reportProbe() { return new ReportProbe(); } }

    /** 실제 JDBC prepare 건수·isolation을 관찰하고 두 SQL 사이 경쟁을 latch로 제어한다. 자료/params는 기록하지 않는다. */
    @Intercepts({@Signature(type = StatementHandler.class, method = "prepare", args = {Connection.class, Integer.class}),
            @Signature(type = Executor.class, method = "query", args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class})})
    public static class ReportProbe implements Interceptor {
        final List<String> prepared = new CopyOnWriteArrayList<>();
        final List<Integer> isolations = new CopyOnWriteArrayList<>();
        final AtomicReference<Barrier> barrier = new AtomicReference<>();
        void reset() { prepared.clear(); isolations.clear(); barrier.set(null); }
        @Override public Object intercept(Invocation invocation) throws Throwable {
            if (invocation.getTarget() instanceof StatementHandler handler) {
                String sql = handler.getBoundSql().getSql();
                if (sql.contains("WITH visible AS")) { prepared.add(sql); isolations.add(((Connection) invocation.getArgs()[0]).getTransactionIsolation()); }
                return invocation.proceed();
            }
            Object result = invocation.proceed();
            if (((MappedStatement) invocation.getArgs()[0]).getId().equals(SQL_NAMESPACE + "selectStats")) {
                Barrier pending = barrier.getAndSet(null);
                if (pending != null) { pending.statsRead().countDown(); if (!pending.writerCommitted().await(30, TimeUnit.SECONDS)) throw new IllegalStateException("Synthetic report writer did not complete"); }
            }
            return result;
        }
    }

    private static Path temporarySecret() {
        try {
            Path directory = Files.createTempDirectory("sc-report-009-"); Path secret = Files.writeString(directory.resolve("bootstrap.secret"), PASSWORD);
            if (Files.getFileStore(secret).supportsFileAttributeView("posix")) Files.setPosixFilePermissions(secret, PosixFilePermissions.fromString("rw-------"));
            return directory;
        } catch (IOException failure) { throw new IllegalStateException("Could not create isolated report fixture"); }
    }
    @AfterAll static void cleanup() throws IOException {
        try (var files = Files.walk(TEMP)) { for (Path path : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path); }
    }
}
