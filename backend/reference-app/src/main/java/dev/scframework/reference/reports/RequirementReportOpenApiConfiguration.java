package dev.scframework.reference.reports;

import io.swagger.v3.oas.models.media.ComposedSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import java.util.List;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 검토 미등록 null과 문자열 enum을 OpenAPI 3.1 anyOf로 표현한다.
 * API JSON은 그대로 두고 생성된 프런트 타입에서 null 검토가 사라지지 않도록 명세만 보정한다.
 */

/** enum의 문자열 선택지와 검토 미등록 null을 실제 OpenAPI 3.1 계약으로 함께 표현한다. */
@Configuration(proxyBeanMethods = false)
public class RequirementReportOpenApiConfiguration {
    @Bean
    OpenApiCustomizer requirementReportJsonContracts() {
        return specification -> {
            Schema<?> owner = specification.getComponents().getSchemas().get("RequirementReportItem");
            Schema<?> original = owner.getProperties().get("reviewDecision");
            // 원래 enum 선택지가 사라진 명세를 조용히 보정하지 않는다. DTO/명세 불일치를 즉시 드러내기 위한 확인이다.
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
            // 문자열 enum 또는 null이라는 실제 응답의 합집합을 표현한다. 프런트 safeParse나 서버 응답 값을 변경하는 코드가 아니다.
            nullable.setAnyOf(List.of(decision, nullValue));
            nullable.setDescription(original.getDescription());
            owner.addProperty("reviewDecision", nullable);
        };
    }
}
