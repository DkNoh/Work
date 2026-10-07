package dev.scframework.autoconfigure;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.autoconfigure.observability.*;
import dev.scframework.autoconfigure.security.SecretFileUsers;
import dev.scframework.core.operations.OperationalEventSink;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.config.MeterFilter;
import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.Tag;
import io.micrometer.tracing.Tracer;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.exporter.otlp.http.logs.OtlpHttpLogRecordExporter;
import io.opentelemetry.sdk.logs.SdkLoggerProvider;
import io.opentelemetry.sdk.logs.export.BatchLogRecordProcessor;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import java.net.URI;
import java.time.Duration;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.core.Ordered;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

@AutoConfiguration(before = ScSecurityAutoConfiguration.class,
        afterName = "org.springframework.boot.actuate.autoconfigure.metrics.MetricsAutoConfiguration")
@ConditionalOnProperty(prefix = "sc.framework.observability", name = "enabled", havingValue = "true")
@EnableConfigurationProperties(ScObservabilityProperties.class)
public class ScObservabilityAutoConfiguration {
    @Bean @ConditionalOnMissingBean(name = "scSafeHttpEventFilter")
    FilterRegistrationBean<SafeHttpEventFilter> scSafeHttpEventFilter(OperationalEventSink events) {
        var registration = new FilterRegistrationBean<>(new SafeHttpEventFilter(events));
        // Boot의 HTTP observation filter 안쪽에서 실행되어 현재 trace와 연결된다.
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 12);
        return registration;
    }
    @Bean @ConditionalOnMissingBean(SpanExporter.class)
    SafeSpanExporter scSafeSpanExporter(ScObservabilityProperties properties, Environment environment,
            ObjectProvider<RequestMappingHandlerMapping> mappings) {
        URI endpoint;
        try { endpoint = URI.create(properties.getOtlpEndpoint()); }
        catch (RuntimeException error) { throw new IllegalStateException("OTLP endpoint is invalid"); }
        if (!("http".equals(endpoint.getScheme()) || "https".equals(endpoint.getScheme()))
                || endpoint.getHost() == null || endpoint.getUserInfo() != null || endpoint.getQuery() != null
                || endpoint.getFragment() != null || !"/v1/traces".equals(endpoint.getPath()))
            throw new IllegalStateException("OTLP endpoint is invalid");
        var delegate = OtlpHttpSpanExporter.builder().setEndpoint(endpoint.toString())
                .setTimeout(Duration.ofSeconds(3)).setConnectTimeout(Duration.ofSeconds(2)).build();
        return new SafeSpanExporter(delegate, () -> registeredRoutes(mappings),
                environment.getProperty("sc.framework.application-name", "sc-application"));
    }
    @Bean @ConditionalOnMissingBean(OperationalEventSink.class)
    OperationalEventSink scOperationalEventSink(ScObservabilityProperties properties, MeterRegistry meters,
            ObjectProvider<Tracer> tracer, ObjectMapper mapper, SdkLoggerProvider logs) {
        return new SafeOperationalEventSink(properties.getEventLog(), properties.getMaxLogBytes(),
                meters, tracer.getIfAvailable(), mapper, logs.get("sc-framework-operations"));
    }
    @Bean(destroyMethod = "close") @ConditionalOnMissingBean(SdkLoggerProvider.class)
    SdkLoggerProvider scSafeOperationalLoggerProvider(ScObservabilityProperties properties, Environment environment) {
        URI traces = URI.create(properties.getOtlpEndpoint());
        if (traces.getHost() == null || traces.getUserInfo() != null || traces.getQuery() != null
                || traces.getFragment() != null || !"/v1/traces".equals(traces.getPath())
                || !("http".equals(traces.getScheme()) || "https".equals(traces.getScheme())))
            throw new IllegalStateException("OTLP endpoint is invalid");
        String application = environment.getProperty("sc.framework.application-name", "sc-application");
        if (!application.matches("[a-z0-9-]{3,64}")) throw new IllegalStateException("Observability application name is invalid");
        String endpoint = traces.resolve("/v1/logs").toString();
        var exporter = OtlpHttpLogRecordExporter.builder().setEndpoint(endpoint)
                .setTimeout(Duration.ofSeconds(3)).setConnectTimeout(Duration.ofSeconds(2)).build();
        return SdkLoggerProvider.builder()
                .setResource(Resource.create(Attributes.of(AttributeKey.stringKey("service.name"), application)))
                .addLogRecordProcessor(BatchLogRecordProcessor.builder(exporter).setMaxQueueSize(2048)
                        .setMaxExportBatchSize(128).setScheduleDelay(Duration.ofMillis(500)).build()).build();
    }
    @Bean
    MeterFilter scSafeHttpMetricTags(ObjectProvider<RequestMappingHandlerMapping> mappings) {
        return new MeterFilter() {
            @Override public Meter.Id map(Meter.Id id) {
                if (!id.getName().startsWith("http.") && !id.getName().startsWith("feign.")) return id;
                return id.replaceTags(id.getTags().stream().map(tag -> {
                    if (Set.of("uri", "url", "http.url", "http.uri").contains(tag.getKey())) {
                        String value = registeredRoutes(mappings).contains(tag.getValue()) ? tag.getValue() : "OTHER";
                        return Tag.of(tag.getKey(), value);
                    }
                    if (Set.of("exception", "error").contains(tag.getKey()))
                        return Tag.of(tag.getKey(), "none".equals(tag.getValue()) ? "none" : "ERROR");
                    return tag;
                }).toList());
            }
        };
    }
    @Bean @Order(0) @ConditionalOnMissingBean(name = "scObserverSecurityChain")
    OperationalSecurityFilterChain scObserverSecurityChain(HttpSecurity http, ScObservabilityProperties properties,
            Environment environment) throws Exception {
        Integer managementPort = environment.getProperty("management.server.port", Integer.class);
        Integer serverPort = environment.getProperty("server.port", Integer.class, 8080);
        if (managementPort == null || managementPort.equals(serverPort))
            throw new IllegalStateException("Observability requires a separate management port");
        var encoder = new BCryptPasswordEncoder();
        var users = SecretFileUsers.load(properties.getObserverSecretFile() == null ? null
                : properties.getObserverSecretFile().toString(), "sc-observer", encoder);
        var provider = new DaoAuthenticationProvider(users); provider.setPasswordEncoder(encoder);
        http.securityMatcher(request -> request.getRequestURI().equals("/actuator/prometheus")
                    && request.getLocalPort() == environment.getProperty("local.management.port", Integer.class, managementPort))
                .authenticationManager(new ProviderManager(provider)).csrf(csrf -> csrf.disable())
                .requestCache(cache -> cache.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(requests -> requests.anyRequest().hasRole("ADMIN"))
                .httpBasic(basic -> {});
        return new OperationalSecurityFilterChain(http.build());
    }
    private static Set<String> registeredRoutes(ObjectProvider<RequestMappingHandlerMapping> mappings) {
        return mappings.stream().flatMap(mapping -> mapping.getHandlerMethods().keySet().stream())
                .flatMap(info -> info.getPatternValues().stream()).collect(Collectors.toUnmodifiableSet());
    }
}
