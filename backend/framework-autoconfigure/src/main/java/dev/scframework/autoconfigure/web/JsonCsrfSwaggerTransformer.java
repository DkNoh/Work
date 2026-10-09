package dev.scframework.autoconfigure.web;

import java.io.IOException;
import java.io.InputStream;
import org.springdoc.core.properties.SwaggerUiConfigParameters;
import org.springdoc.core.properties.SwaggerUiConfigProperties;
import org.springdoc.core.properties.SwaggerUiOAuthProperties;
import org.springdoc.core.providers.ObjectMapperProvider;
import org.springdoc.webmvc.ui.SwaggerIndexPageTransformer;
import org.springdoc.webmvc.ui.SwaggerWelcomeCommon;

/*
 * Swagger initializer에 same-origin 쿠키/CSRF 요청 interceptor를 연결하는 개발 문서 어댑터다.
 * Java text block 안 문자열은 실행될 JavaScript 산출물이다. 안전 메서드 이외의 동일 origin 요청 전에 CSRF JSON을 가져온다.
 * 기대 initializer 표식이 없으면 조용히 실패하지 않고 지원하지 않는 레이아웃으로 알려 준다.
 */

/** springdoc 2.9.1의 실제 initializer 변환 지점에 JSON CSRF interceptor를 연결한다. */
public final class JsonCsrfSwaggerTransformer extends SwaggerIndexPageTransformer {
    private static final String INTERCEPTOR = """
            requestInterceptor: async function(request) {
              request.credentials = 'same-origin';
              const target = new URL(request.url, window.location.origin);
              if (target.origin === window.location.origin && !['GET','HEAD','OPTIONS'].includes((request.method || 'GET').toUpperCase())) {
                const response = await fetch('/api/auth/csrf', {credentials:'same-origin',cache:'no-store'});
                if (!response.ok) throw new Error('Could not obtain CSRF token');
                const csrf = await response.json();
                request.headers = request.headers || {};
                request.headers[csrf.headerName] = csrf.token;
              }
              return request;
            },
            """;

    public JsonCsrfSwaggerTransformer(SwaggerUiConfigProperties properties, SwaggerUiOAuthProperties oauth,
            SwaggerWelcomeCommon welcome, ObjectMapperProvider mapper) {
        super(properties, oauth, welcome, mapper);
    }

    @Override
    protected String defaultTransformations(SwaggerUiConfigParameters parameters, InputStream input) throws IOException {
        String initializer = super.defaultTransformations(parameters, input);
        if (!initializer.contains("presets: [")) throw new IOException("Unsupported Swagger initializer layout");
        return initializer.replace("presets: [", INTERCEPTOR + "presets: [");
    }
}
