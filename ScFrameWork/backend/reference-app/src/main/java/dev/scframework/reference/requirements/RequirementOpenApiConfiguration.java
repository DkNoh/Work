package dev.scframework.reference.requirements;

import io.swagger.v3.oas.models.media.ComposedSchema;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.Schema;
import java.util.List;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Java DTO 어노테이션만으로 달라질 수 있는 OpenAPI 3.1 숫자 enum/null 참조 표현을 보정한다.
 * 런타임 업무 JSON을 바꾸는 코드가 아니라 명세와 생성 TypeScript 타입이 실제 응답을 따르게 하는 구성이다.
 */

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

    // Java int 기반 0/1 계약을 실제 JSON Schema integer enum으로 명시해 프런트 타입이 boolean/문자열로 생성되지 않게 한다.
    private void numericFlag(Schema<?> owner, String field) {
        IntegerSchema flag = new IntegerSchema();
        flag.setEnum(List.of(0, 1));
        flag.setTypes(Set.of("integer"));
        owner.addProperty(field, flag);
    }

    // 참조 타입과 null을 anyOf로 합친다. 원래 $ref가 없으면 조용히 잘못된 명세를 배포하지 않고 시작/명세 생성에서 실패시킨다.
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
