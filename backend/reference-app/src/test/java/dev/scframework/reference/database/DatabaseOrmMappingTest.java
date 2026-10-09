package dev.scframework.reference.database;

import dev.scframework.reference.documents.DocumentEntity;
import dev.scframework.reference.kanban.KanbanTaskEntity;
import dev.scframework.reference.requirements.CommentEntity;
import dev.scframework.reference.requirements.HistoryEntity;
import dev.scframework.reference.requirements.RequirementEntity;
import dev.scframework.reference.requirements.ReviewEntity;
import java.util.Map;
import java.util.function.Consumer;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.boot.spi.MetadataImplementor;
import org.hibernate.dialect.DatabaseVersion;
import org.hibernate.dialect.Dialect;
import org.hibernate.dialect.DB2Dialect;
import org.hibernate.dialect.H2Dialect;
import org.hibernate.dialect.OracleDialect;
import org.hibernate.dialect.OracleServerConfiguration;
import org.hibernate.dialect.PostgreSQLDialect;
import org.hibernate.dialect.SQLServerDialect;
import org.hibernate.engine.jdbc.dialect.spi.DialectResolutionInfo;
import org.hibernate.mapping.Column;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 연결 없이 실제 엔티티·ORM XML·Hibernate dialect로 기대 열 타입을 계산한다.
 * 외부 DB 미실행 상태에서도 시작 전 ddl-auto=validate의 확실한 매핑 불일치를 찾는다.
 * 이 테스트의 성공은 Oracle/SQL Server JDBC 또는 실제 DDL 실행 성공을 뜻하지 않는다.
 */
class DatabaseOrmMappingTest {
    private static final Map<Class<?>, String[]> LONG_TEXT = Map.of(
            RequirementEntity.class, new String[]{"desired", "reason", "referenceText", "followParts"},
            ReviewEntity.class, new String[]{"rationale", "conditions", "scope", "exclusions", "acceptance"},
            CommentEntity.class, new String[]{"body"},
            KanbanTaskEntity.class, new String[]{"description"});

    @Test
    void oracleExtendedWithoutOverrideExposesTheClobMismatch() {
        // 이전 annotation만 사용하면 EXTENDED의 32767 한도 때문에 앱 CLOB DDL과 다른 VARCHAR2를 기대한다.
        metadata(oracle(true), null, false, model -> {
            assertThat(column(model, RequirementEntity.class, "desired").getSqlType(model)).startsWith("varchar2(");
            assertThat(column(model, ReviewEntity.class, "conditions").getSqlType(model)).startsWith("varchar2(");
            assertThat(column(model, ReviewEntity.class, "conditions").isNullable()).isFalse();
        });
    }

    @Test
    void oracleOverrideMatchesClobAndNullableColumnsWithBothStringSizeModes() {
        for (boolean extended : new boolean[]{false, true}) {
            metadata(oracle(extended), "database/oracle-orm.xml", false, model -> {
                LONG_TEXT.forEach((entity, fields) -> {
                    for (String field : fields) assertThat(column(model, entity, field).getSqlType(model))
                            .as(entity.getSimpleName() + "." + field + " Oracle CLOB").isEqualTo("clob");
                });
                for (String field : new String[]{"referenceText", "followParts"})
                    assertThat(column(model, RequirementEntity.class, field).isNullable()).isTrue();
                for (String field : new String[]{"conditions", "scope", "exclusions", "acceptance"})
                    assertThat(column(model, ReviewEntity.class, field).isNullable()).isTrue();
                assertThat(column(model, KanbanTaskEntity.class, "description").isNullable()).isTrue();
                assertThat(column(model, RequirementEntity.class, "desired").isNullable()).isFalse();
                assertThat(column(model, RequirementEntity.class, "reason").isNullable()).isFalse();
                assertThat(column(model, ReviewEntity.class, "rationale").isNullable()).isFalse();
                assertThat(column(model, CommentEntity.class, "body").isNullable()).isFalse();
                assertThat(model.getEntityBinding(RequirementEntity.class.getName()).getVersion().getName()).isEqualTo("revision");
                assertThat(model.getEntityBinding(KanbanTaskEntity.class.getName()).getVersion().getName()).isEqualTo("revision");
                assertThat(column(model, DocumentEntity.class, "documentJson").getSqlType(model)).isEqualTo("clob");
                assertThat(column(model, HistoryEntity.class, "afterJson").getSqlType(model)).isEqualTo("clob");
            });
        }
    }

    @Test
    void sqlServerNationalizedMappingMatchesShortAndLongTextDdl() {
        metadata(new SQLServerDialect(DatabaseVersion.make(15)), null, true, model -> {
            assertThat(column(model, RequirementEntity.class, "title").getSqlType(model)).isEqualTo("nvarchar(200)");
            LONG_TEXT.forEach((entity, fields) -> {
                for (String field : fields) assertThat(column(model, entity, field).getSqlType(model))
                        .as(entity.getSimpleName() + "." + field + " SQL Server NVARCHAR(MAX)").isEqualTo("nvarchar(max)");
            });
            assertThat(column(model, DocumentEntity.class, "documentJson").getSqlType(model)).isEqualTo("nvarchar(max)");
            assertThat(column(model, HistoryEntity.class, "afterJson").getSqlType(model)).isEqualTo("nvarchar(max)");
            assertThat(column(model, RequirementEntity.class, "createdAt").getSqlType(model)).isEqualTo("datetimeoffset(6)");
        });
    }

    @Test
    void longJsonMappingPreservesH2PostgresqlAndDb2Ddl() {
        Map<Dialect, String> expected = Map.of(
                new H2Dialect(DatabaseVersion.make(2, 3, 232)), "clob",
                new PostgreSQLDialect(DatabaseVersion.make(14)), "text",
                new DB2Dialect(DatabaseVersion.make(11, 5)), "clob");
        expected.forEach((dialect, type) -> metadata(dialect, null, false, model -> {
            assertThat(column(model, DocumentEntity.class, "documentJson").getSqlType(model)).isEqualTo(type);
            assertThat(column(model, HistoryEntity.class, "beforeJson").getSqlType(model)).isEqualTo(type);
            assertThat(column(model, HistoryEntity.class, "afterJson").getSqlType(model)).isEqualTo(type);
        }));
    }

    private static Column column(MetadataImplementor model, Class<?> entity, String property) {
        return model.getEntityBinding(entity.getName()).getProperty(property).getColumns().getFirst();
    }

    private static void metadata(Dialect dialect, String mapping, boolean nationalized, Consumer<MetadataImplementor> verify) {
        var registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.dialect", dialect)
                .applySetting("hibernate.boot.allow_jdbc_metadata_access", false)
                .build();
        try {
            var sources = new MetadataSources(registry)
                    .addAnnotatedClass(RequirementEntity.class).addAnnotatedClass(ReviewEntity.class)
                    .addAnnotatedClass(CommentEntity.class).addAnnotatedClass(KanbanTaskEntity.class)
                    .addAnnotatedClass(DocumentEntity.class).addAnnotatedClass(HistoryEntity.class);
            if (mapping != null) sources.addResource(mapping);
            var builder = sources.getMetadataBuilder().enableGlobalNationalizedCharacterDataSupport(nationalized);
            if (dialect instanceof OracleDialect) builder.applyPhysicalNamingStrategy(new OracleReferenceNamingStrategy());
            var model = (MetadataImplementor) builder.build();
            model.validate();
            verify.accept(model);
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
    }

    private static OracleDialect oracle(boolean extended) {
        var info = new DialectResolutionInfo() {
            @Override public String getDatabaseName() { return "Oracle"; }
            @Override public String getDatabaseVersion() { return "19"; }
            @Override public int getDatabaseMajorVersion() { return 19; }
            @Override public int getDatabaseMinorVersion() { return 0; }
            @Override public String getDriverName() { return "Oracle JDBC"; }
            @Override public int getDriverMajorVersion() { return 23; }
            @Override public int getDriverMinorVersion() { return 7; }
            @Override public String getSQLKeywords() { return ""; }
        };
        return new OracleDialect(info, new OracleServerConfiguration(false, extended, false, 23, 7));
    }
}
