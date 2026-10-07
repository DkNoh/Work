package dev.scframework.autoconfigure;

import java.util.Map;
import org.springframework.boot.autoconfigure.AutoConfigurationImportFilter;
import org.springframework.boot.autoconfigure.AutoConfigurationMetadata;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.env.Environment;

/** Starter를 설치해도 선택 기능이 켜지기 전에는 외부 연결이나 worker를 만들지 않는다. */
public final class ScOptionalInfrastructureFilter implements AutoConfigurationImportFilter, EnvironmentAware {
    private Environment environment;
    private static final Map<String, String> OPTIONAL = Map.of(
        "org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration", "sc.framework.messaging.enabled",
        "org.springframework.boot.autoconfigure.quartz.QuartzAutoConfiguration", "sc.framework.scheduler.enabled",
        "org.springframework.boot.actuate.autoconfigure.metrics.export.prometheus.PrometheusMetricsExportAutoConfiguration", "sc.framework.observability.enabled",
        "org.springframework.boot.actuate.autoconfigure.tracing.OpenTelemetryTracingAutoConfiguration", "sc.framework.observability.enabled");

    @Override public void setEnvironment(Environment environment) { this.environment = environment; }
    @Override public boolean[] match(String[] names, AutoConfigurationMetadata metadata) {
        boolean[] accepted = new boolean[names.length];
        for (int i = 0; i < names.length; i++) {
            String name = names[i];
            // 기본 OTLP exporter는 원문 span을 내보내므로 공통의 정제 exporter가 맡는다.
            if ("org.springframework.boot.actuate.autoconfigure.tracing.otlp.OtlpTracingAutoConfiguration".equals(name)) {
                accepted[i] = false;
                continue;
            }
            String property = name == null ? null : OPTIONAL.get(name);
            accepted[i] = property == null || (environment != null && environment.getProperty(property, Boolean.class, false));
        }
        return accepted;
    }
}
