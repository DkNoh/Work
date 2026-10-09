package dev.scframework.autoconfigure;

import dev.scframework.core.ApiError;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.HeaderParameter;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.properties.SwaggerUiConfigProperties;
import org.springdoc.core.properties.SwaggerUiOAuthProperties;
import org.springdoc.core.providers.ObjectMapperProvider;
import org.springdoc.webmvc.ui.SwaggerConfig;
import org.springdoc.webmvc.ui.SwaggerIndexTransformer;
import org.springdoc.webmvc.ui.SwaggerWelcomeCommon;
import dev.scframework.autoconfigure.web.JsonCsrfSwaggerTransformer;

/*
 * dev 프로필에서 세션·CSRF·공통 오류의 OpenAPI 문서를 구성한다. 문서 설정 자체가 인증을 수행하지는 않는다.
 * Spring Security 필터가 처리하는 로그인/로그아웃도 명시하며 운영 API operationId를 경로 기반으로 고정한다.
 * Swagger 변환기를 연결해 쓰기 요청 전에 현재 세션 CSRF JSON을 조회하도록 한다.
 */

@AutoConfiguration(after = ScWebAutoConfiguration.class, before = SwaggerConfig.class)
@ConditionalOnClass(OpenAPI.class)
@Profile("dev")
public class ScOpenApiAutoConfiguration {
    @Bean @ConditionalOnMissingBean(name = "scOperationalOpenApiOperations")
    OpenApiCustomizer scOperationalOpenApiOperations() {
        // 업무 Controller 이름이 같아도 공통 운영 API의 공개 타입 이름은 변하지 않는다.
        return api -> api.getPaths().forEach((path, item) -> {
            if (path.startsWith("/api/operations/")) {
                item.readOperationsMap().forEach((method, operation) -> operation.setOperationId(
                        "scOperations_" + method.name().toLowerCase(java.util.Locale.ROOT) + "_"
                                + path.substring("/api/operations/".length()).replaceAll("[^a-zA-Z0-9]+", "_")));
            }
        });
    }

    @Bean @ConditionalOnMissingBean(SwaggerIndexTransformer.class)
    @ConditionalOnProperty(name = "springdoc.swagger-ui.enabled", havingValue = "true")
    SwaggerIndexTransformer scJsonCsrfSwaggerTransformer(SwaggerUiConfigProperties properties,
            SwaggerUiOAuthProperties oauth, SwaggerWelcomeCommon welcome, ObjectMapperProvider mapper) {
        return new JsonCsrfSwaggerTransformer(properties, oauth, welcome, mapper);
    }

    @Bean @ConditionalOnMissingBean(name = "scPublicOpenApiOperations")
    // 공개 health/CSRF/login은 전역 session 요구를 문서상 해제한다. 실제 접근 허용은 Security 체인의 책임이다.
    OpenApiCustomizer scPublicOpenApiOperations() {
        return api -> {
            for (String path : java.util.List.of("/api/health", "/api/auth/csrf", "/api/auth/login")) {
                var item = api.getPaths().get(path);
                if (item != null) item.readOperations().forEach(operation -> operation.setSecurity(java.util.List.of()));
            }
        };
    }

    @Bean @ConditionalOnMissingBean(OpenAPI.class)
    // Controller가 없는 Security 필터 endpoint도 명세에 넣는다. 성공 204/오류 JSON/쿠키 세션을 실제 HTTP 계약과 맞춘다.
    OpenAPI scOpenApi(ScFrameworkProperties properties) {
        Components components = new Components().addSecuritySchemes("session", new SecurityScheme()
                .type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.COOKIE).name("JSESSIONID")
                .description("같은 브라우저의 로그인 세션. HttpOnly 쿠키를 Authorize 입력으로 설정하지 않는다."));
        ModelConverters.getInstance().readAll(ApiError.class).forEach(components::addSchemas);
        components.getSchemas().get("ApiError").setRequired(java.util.List.of("code", "message", "errors"));
        components.getSchemas().get("FieldViolation").setRequired(java.util.List.of("field", "message"));
        Schema<?> loginSchema = new Schema<>().type("object")
                .addProperty("username", new StringSchema()).addProperty("password", new StringSchema().format("password"))
                .addRequiredItem("username").addRequiredItem("password");
        Content errorContent = new Content().addMediaType("application/json",
                new io.swagger.v3.oas.models.media.MediaType().schema(new Schema<>().$ref("#/components/schemas/ApiError")));
        ApiResponses authResponses = new ApiResponses().addApiResponse("204", new ApiResponse().description("성공, 본문 없음"))
                .addApiResponse("401", new ApiResponse().description("인증 실패").content(errorContent))
                .addApiResponse("403", new ApiResponse().description("CSRF 거부").content(errorContent));
        HeaderParameter csrfHeader = new HeaderParameter();
        csrfHeader.name("X-CSRF-TOKEN").description("GET /api/auth/csrf가 발급한 token. Swagger interceptor가 갱신한다.")
                .schema(new StringSchema());
        Operation login = new Operation().summary("폼 로그인").security(java.util.List.of()).addTagsItem("session").responses(authResponses)
                .addParametersItem(csrfHeader).requestBody(new RequestBody().required(true).content(new Content()
                        .addMediaType("application/x-www-form-urlencoded", new io.swagger.v3.oas.models.media.MediaType().schema(loginSchema))));
        Operation logout = new Operation().summary("세션 로그아웃").addTagsItem("session").responses(authResponses)
                .addParametersItem(csrfHeader).addSecurityItem(new SecurityRequirement().addList("session"));
        return new OpenAPI().info(new Info().title(properties.getApplicationName()).version("0.1.0"))
                .components(components).addSecurityItem(new SecurityRequirement().addList("session"))
                .path("/api/auth/login", new PathItem().post(login))
                .path("/api/auth/logout", new PathItem().post(logout));
    }
}
