package dev.scframework.reference.requirements;

import io.swagger.v3.oas.models.media.ComposedSchema;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.Schema;
import java.util.List;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 원본 숫자 플래그와 null 가능한 참조를 OpenAPI 3.1의 실제 JSON Schema로 표현한다. */
@Configuration(proxyBeanMethods = false)
public class RequirementOpenApiConfiguration {
    @Bean
    OpenApiCustomizer requirementJsonContracts() {
        return specification -> {
            var schemas = specification.getComponents().getSchemas();
            for (String name : List.of("RequirementSummary", "RequirementDetail")) {
                numericFlag(schemas.get(name), "similar");
            }
            numericFlag(schemas.get("MenuResponse"), "active");
            numericFlag(schemas.get("RequirementScreenVersionResponse"), "archived");
            for (String field : List.of("annotation", "screenVersion", "review", "ado")) {
                nullableReference(schemas.get("RequirementDetail"), field);
            }
            nullableReference(schemas.get("RequirementInput"), "annotation");
        };
    }

    private void numericFlag(Schema<?> owner, String field) {
        IntegerSchema flag = new IntegerSchema();
        flag.setEnum(List.of(0, 1));
        flag.setTypes(Set.of("integer"));
        owner.addProperty(field, flag);
    }

    private void nullableReference(Schema<?> owner, String field) {
        Schema<?> original = owner.getProperties().get(field);
        String reference = original.get$ref();
        if (reference == null) throw new IllegalStateException("Requirement nullable schema reference is missing");
        Schema<?> nullValue = new Schema<>();
        nullValue.setType("null"); nullValue.setTypes(Set.of("null"));
        ComposedSchema nullable = new ComposedSchema();
        nullable.setAnyOf(List.of(new Schema<>().$ref(reference), nullValue));
        nullable.setDescription(original.getDescription());
        owner.addProperty(field, nullable);
    }
}
