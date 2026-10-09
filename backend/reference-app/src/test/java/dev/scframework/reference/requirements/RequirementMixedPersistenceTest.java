package dev.scframework.reference.requirements;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.querydsl.jpa.impl.JPAQueryFactory;
import dev.scframework.core.ApiException;
import dev.scframework.reference.identity.UserEntity;
import dev.scframework.reference.identity.UserRepository;
import dev.scframework.reference.menu.MenuDtos.MenuInput;
import dev.scframework.reference.menu.MenuService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.FlushModeType;
import jakarta.persistence.PersistenceContext;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import javax.sql.DataSource;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.session.LocalCacheScope;
import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.mapper.MapperFactoryBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.orm.jpa.EntityManagerFactoryInfo;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** SQL 가시성과 업무 명령 원자성을 실제 H2/JPA/Querydsl/MyBatis 조합으로 검사한다. */
@SpringBootTest
@Import(RequirementMixedPersistenceTest.ProbeConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class RequirementMixedPersistenceTest {
    private static final Path TEMP = createTemp();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE", () -> TEMP.resolve("bootstrap.secret").toString());
        registry.add("SC_BOOTSTRAP_USERNAME", () -> "mixed-admin");
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:mixed-" + TEMP.getFileName() + ";DB_CLOSE_DELAY=-1");
        registry.add("logging.file.name", () -> TEMP.resolve("mixed.log").toString());
    }

    @Autowired RequirementService service;
    @Autowired RequirementRepository requirements;
    @Autowired UserRepository users;
    @Autowired MenuService menus;
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    @Autowired EntityManagerFactory entityManagerFactory;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired SqlSessionFactory sessions;
    @Autowired RequirementProbeMapper mapper;
    @Autowired JPAQueryFactory queries;
    @Autowired Clock clock;
    @PersistenceContext EntityManager em;
    private UserEntity author;
    private UserEntity outsider;
    private long menuId;
    private RequirementDtos.RequirementDetail original;

    @BeforeEach
    void syntheticFixtures() {
        for (String table : List.of("requirement_history", "requirement_comment", "requirement_review",
                "requirement_entry", "menu_entry", "security_audit_event")) jdbc.update("DELETE FROM " + table);
        jdbc.update("DELETE FROM reference_user WHERE username <> ?", "mixed-admin");
        author = users.findByUsername("mixed-admin").orElseThrow();
        outsider = users.saveAndFlush(new UserEntity("mixed-outsider", "다른 작성자", author.getPasswordHash(),
                "REQUESTER", clock.instant()));
        menuId = menus.create(new MenuInput(null, "혼합 저장소 합성 메뉴", 0), author).id();
        original = service.create(input("before mixed flush", 1), author);
    }

    @Test
    void explicitJpaFlushChangesBothReadersAndChildHistoryRollsBackOnTheSameTransaction() {
        assertThat(transactionManager).isInstanceOf(JpaTransactionManager.class);
        JpaTransactionManager jpa = (JpaTransactionManager) transactionManager;
        assertThat(jpa.getEntityManagerFactory()).isSameAs(entityManagerFactory);
        assertThat(jpa.getDataSource()).isSameAs(dataSource);
        assertThat(((EntityManagerFactoryInfo) entityManagerFactory).getDataSource()).isSameAs(dataSource);
        assertThat(sessions.getConfiguration().getEnvironment().getDataSource()).isSameAs(dataSource);
        assertThat(sessions.getConfiguration().getLocalCacheScope()).isEqualTo(LocalCacheScope.STATEMENT);

        long originalAudit = successfulUpdateAudits();
        assertThatThrownBy(() -> transaction().execute(status -> {
            RequirementEntity managed = requirements.findById(original.id()).orElseThrow();
            // 이 테스트의 직접 dirty 변경은 flush 가시성 probe다. 실제 업무 쓰기는 아래 Service 테스트가 검사한다.
            managed.edit(input("after mixed flush", 1));
            managed.changed("DRAFT", clock.instant());
            assertReaders("before mixed flush", 1, 1);
            em.flush();
            assertThat(managed.getRevision()).isEqualTo(2);
            assertReaders("after mixed flush", 2, 1);
            // IDENTITY INSERT는 persist 시 SQL이 실행되므로 별도 deferred flush처럼 설명하지 않는다.
            em.persist(new HistoryEntity(original.id(), "MIXED_FLUSH_PROBE", null,
                    "{\"probe\":true}", author.getId(), clock.instant()));
            assertReaders("after mixed flush", 2, 2);
            throw new SyntheticRollback();
        })).isInstanceOf(SyntheticRollback.class);

        assertReaders("before mixed flush", 1, 1);
        assertThat(requirements.findById(original.id()).orElseThrow().getRevision()).isEqualTo(1);
        assertThat(successfulUpdateAudits()).isEqualTo(originalAudit);
    }

    @Test
    void guardedServiceCommitIsVisibleToQuerydslAndMyBatisWithExactlyOneCommittedAudit() {
        long before = successfulUpdateAudits();
        transaction().executeWithoutResult(status -> {
            RequirementDtos.RequirementDetail updated = service.update(original.id(), input("committed title", 1), author);
            assertThat(updated.revision()).isEqualTo(2);
            assertReaders("committed title", 2, 2);
            assertThat(mapper.latestHistoryAction(original.id())).isEqualTo("EDIT");
            // 성공 감사는 업무 commit 전에는 DB에 생기지 않는다.
            assertThat(successfulUpdateAudits()).isEqualTo(before);
        });
        assertReaders("committed title", 2, 2);
        assertThat(successfulUpdateAudits()).isEqualTo(before + 1);
    }

    @Test
    void outerRollbackRevertsFlushedServiceCommandRevisionAndHistoryWithoutFalseSuccessAudit() {
        long before = successfulUpdateAudits();
        assertThatThrownBy(() -> transaction().execute(status -> {
            service.update(original.id(), input("must rollback", 1), author);
            assertReaders("must rollback", 2, 2);
            assertThat(mapper.latestHistoryAction(original.id())).isEqualTo("EDIT");
            assertThat(successfulUpdateAudits()).isEqualTo(before);
            throw new SyntheticRollback();
        })).isInstanceOf(SyntheticRollback.class);
        assertReaders("before mixed flush", 1, 1);
        assertThat(mapper.latestHistoryAction(original.id())).isEqualTo("CREATE");
        assertThat(successfulUpdateAudits()).isEqualTo(before);
    }

    @Test
    void outerTransactionDoesNotBypassServiceOwnerAndRevisionGuardsOrAppendPartialHistory() {
        long before = successfulUpdateAudits();
        assertThatThrownBy(() -> transaction().execute(status ->
                service.update(original.id(), input("wrong owner", 1), outsider)))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status()).isEqualTo(403);
                    assertThat(error.error().code()).isEqualTo("FORBIDDEN");
                });
        assertThatThrownBy(() -> transaction().execute(status ->
                service.update(original.id(), input("future revision", 2), author)))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status()).isEqualTo(409);
                    assertThat(error.error().code()).isEqualTo("REVISION_CONFLICT");
                });
        assertReaders("before mixed flush", 1, 1);
        assertThat(mapper.latestHistoryAction(original.id())).isEqualTo("CREATE");
        assertThat(successfulUpdateAudits()).isEqualTo(before);
    }

    private TransactionTemplate transaction() { return new TransactionTemplate(transactionManager); }

    private RequirementDtos.RequirementInput input(String title, int revision) {
        return new RequirementDtos.RequirementInput(title, menuId, "희망 동작", "이유", "", false, "", null, null, revision);
    }

    private long successfulUpdateAudits() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE resource_type = ? AND resource_id = ?"
                + " AND action = ? AND outcome = ?", Long.class,
                "REQUIREMENT", Long.toString(original.id()), "REQUIREMENT_UPDATE", "SUCCESS");
    }

    private void assertReaders(String title, int revision, long historyCount) {
        assertThat(mapper.title(original.id())).isEqualTo(title);
        assertThat(mapper.revision(original.id())).isEqualTo(revision);
        assertThat(mapper.historyCount(original.id())).isEqualTo(historyCount);
        QRequirementEntity request = QRequirementEntity.requirementEntity;
        QHistoryEntity history = QHistoryEntity.historyEntity;
        // AUTO query가 dirty JPA를 먼저 flush하여 'flush 전' 검사를 무효화하지 않도록 명시한다.
        assertThat(queries.select(request.title).from(request).where(request.id.eq(original.id()))
                .setFlushMode(FlushModeType.COMMIT).fetchOne()).isEqualTo(title);
        assertThat(queries.select(request.revision).from(request).where(request.id.eq(original.id()))
                .setFlushMode(FlushModeType.COMMIT).fetchOne()).isEqualTo(revision);
        assertThat(queries.select(history.id.count()).from(history).where(history.requirementId.eq(original.id()))
                .setFlushMode(FlushModeType.COMMIT).fetchOne()).isEqualTo(historyCount);
    }

    /** 테스트 전용 bound read Mapper. 생산 경로/DDL/별도 DataSource를 만들지 않는다. */
    public interface RequirementProbeMapper {
        @Select("SELECT title FROM requirement_entry WHERE id = #{id}")
        String title(@Param("id") long id);
        @Select("SELECT revision FROM requirement_entry WHERE id = #{id}")
        int revision(@Param("id") long id);
        @Select("SELECT COUNT(*) FROM requirement_history WHERE requirement_id = #{id}")
        long historyCount(@Param("id") long id);
        @Select("SELECT action FROM requirement_history WHERE requirement_id = #{id} ORDER BY id DESC LIMIT 1")
        String latestHistoryAction(@Param("id") long id);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ProbeConfiguration {
        @Bean
        RequirementProbeMapper requirementProbeMapper(SqlSessionFactory sessions) throws Exception {
            MapperFactoryBean<RequirementProbeMapper> mapper = new MapperFactoryBean<>(RequirementProbeMapper.class);
            mapper.setSqlSessionFactory(sessions);
            // FactoryBean 자체를 등록하면 MyBatis 기본 @Mapper 스캔이 backoff하므로 proxy만 테스트 bean으로 둔다.
            mapper.afterPropertiesSet();
            return mapper.getObject();
        }
    }

    private static final class SyntheticRollback extends RuntimeException {}

    private static Path createTemp() {
        try {
            Path temp = Files.createTempDirectory("sc-mixed-008-");
            Path secret = Files.writeString(temp.resolve("bootstrap.secret"), "synthetic-mixed-password-only-008");
            if (Files.getFileStore(secret).supportsFileAttributeView("posix"))
                Files.setPosixFilePermissions(secret, PosixFilePermissions.fromString("rw-------"));
            return temp;
        } catch (IOException failure) { throw new IllegalStateException("Could not create isolated mixed test fixture"); }
    }

    @AfterAll
    static void cleanup() throws IOException {
        try (var files = Files.walk(TEMP)) {
            for (Path path : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }
}
