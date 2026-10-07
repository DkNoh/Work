package dev.scframework.autoconfigure.web;

import java.io.IOException;
import java.io.InputStream;
import org.springdoc.core.properties.SwaggerUiConfigParameters;
import org.springdoc.core.properties.SwaggerUiConfigProperties;
import org.springdoc.core.properties.SwaggerUiOAuthProperties;
import org.springdoc.core.providers.ObjectMapperProvider;
import org.springdoc.webmvc.ui.SwaggerIndexPageTransformer;
import org.springdoc.webmvc.ui.SwaggerWelcomeCommon;

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
