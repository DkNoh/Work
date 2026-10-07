package dev.scframework.reference.reports;

import io.swagger.v3.oas.models.media.ComposedSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import java.util.List;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** enum의 문자열 선택지와 검토 미등록 null을 실제 OpenAPI 3.1 계약으로 함께 표현한다. */
@Configuration(proxyBeanMethods = false)
public class RequirementReportOpenApiConfiguration {
    @Bean
    OpenApiCustomizer requirementReportJsonContracts() {
        return specification -> {
            Schema<?> owner = specification.getComponents().getSchemas().get("RequirementReportItem");
            Schema<?> original = owner.getProperties().get("reviewDecision");
            if (original.getEnum() == null || original.getEnum().isEmpty()) {
                throw new IllegalStateException("Report decision schema choices are missing");
            }
            StringSchema decision = new StringSchema();
            decision.setEnum(original.getEnum().stream().map(String::valueOf).toList());
            decision.setTypes(Set.of("string"));
            Schema<?> nullValue = new Schema<>();
            nullValue.setType("null");
            nullValue.setTypes(Set.of("null"));
            ComposedSchema nullable = new ComposedSchema();
            nullable.setAnyOf(List.of(decision, nullValue));
            nullable.setDescription(original.getDescription());
            owner.addProperty("reviewDecision", nullable);
        };
    }
}
