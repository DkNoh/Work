package dev.scframework.autoconfigure;

import dev.scframework.autoconfigure.observability.SafeSpanExporter;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import io.opentelemetry.sdk.common.CompletableResultCode;
import java.util.Collection;
import java.util.ArrayList;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class SafeSpanExporterTest {
    @Test void micrometerHttpTagsAreMappedWithoutExportingRawUriOrUnknownStatus() {
        var exported = new ArrayList<SpanData>();
        SpanExporter capture = new SpanExporter() {
            public CompletableResultCode export(Collection<SpanData> spans) { exported.addAll(spans); return CompletableResultCode.ofSuccess(); }
            public CompletableResultCode flush() { return CompletableResultCode.ofSuccess(); }
            public CompletableResultCode shutdown() { return CompletableResultCode.ofSuccess(); }
        };
        var safe = new SafeSpanExporter(capture, () -> Set.of("/api/notes/{id}"), "sc-test-app");
        try (var provider = SdkTracerProvider.builder().addSpanProcessor(SimpleSpanProcessor.create(safe)).build()) {
            var tracer = provider.get("synthetic-http-tags");
            var valid = tracer.spanBuilder("GET /api/notes/100").startSpan();
            valid.setAttribute("method", "GET").setAttribute("uri", "/api/notes/{id}").setAttribute("status", "200").end();
            var raw = tracer.spanBuilder("raw URI").startSpan();
            raw.setAttribute("method", "RAW_CANARY").setAttribute("uri", "/api/notes/100?private=RAW_CANARY")
                    .setAttribute("status", "STATUS_UNKNOWN").end();
        }
        assertThat(exported).hasSize(2);
        assertThat(exported.get(0).getAttributes().get(AttributeKey.stringKey("http.route"))).isEqualTo("/api/notes/{id}");
        assertThat(exported.get(0).getAttributes().get(AttributeKey.stringKey("http.request.method"))).isEqualTo("GET");
        assertThat(exported.get(0).getAttributes().get(AttributeKey.longKey("http.response.status_code"))).isEqualTo(200L);
        assertThat(exported.get(1).getAttributes().isEmpty()).isTrue();
    }

    @Test void realSdkSpansKeepTraceRelationsAndOnlyRegisteredSafeHttpFields() {
        String canary = "CANARY_PASSWORD_QUERY_BODY_SQL_STACK";
        var exported = new ArrayList<SpanData>();
        SpanExporter capture = new SpanExporter() {
            public CompletableResultCode export(Collection<SpanData> spans) { exported.addAll(spans); return CompletableResultCode.ofSuccess(); }
            public CompletableResultCode flush() { return CompletableResultCode.ofSuccess(); }
            public CompletableResultCode shutdown() { return CompletableResultCode.ofSuccess(); }
        };
        var safe = new SafeSpanExporter(capture, () -> Set.of("/api/notes/{id}"), "sc-test-app");
        try (var provider = SdkTracerProvider.builder().addSpanProcessor(SimpleSpanProcessor.create(safe)).build()) {
            var tracer = provider.get("raw-" + canary);
            var parent = tracer.spanBuilder(canary).setSpanKind(SpanKind.SERVER).startSpan();
            parent.setAttribute("http.route", "/api/notes/{id}").setAttribute("http.request.method", "GET")
                    .setAttribute("http.response.status_code", 500L).setAttribute("url.full", canary)
                    .setAttribute("db.statement", canary).setStatus(StatusCode.ERROR, canary)
                    .recordException(new IllegalStateException(canary));
            try (var scope = parent.makeCurrent()) {
                var child = tracer.spanBuilder(canary).setSpanKind(SpanKind.CLIENT).startSpan();
                child.setAttribute("http.route", "/api/" + canary).setAttribute("http.method", "BAD" + canary);
                child.addEvent(canary, Attributes.of(AttributeKey.stringKey("request.body"), canary)); child.end();
            }
            parent.end();
        }
        assertThat(exported).hasSize(2);
        var child = exported.get(0); var parent = exported.get(1);
        assertThat(child.getTraceId()).isEqualTo(parent.getTraceId());
        assertThat(child.getParentSpanId()).isEqualTo(parent.getSpanId());
        assertThat(parent.getAttributes().asMap().keySet()).extracting(AttributeKey::getKey)
                .containsExactlyInAnyOrder("http.route", "http.request.method", "http.response.status_code", "error.type");
        assertThat(child.getAttributes().isEmpty()).isTrue();
        for (var span : exported) {
            assertThat(span.getName()).doesNotContain(canary);
            assertThat(span.getAttributes().toString()).doesNotContain(canary);
            assertThat(span.getEvents()).isEmpty(); assertThat(span.getLinks()).isEmpty();
            assertThat(span.getStatus().getDescription()).isEmpty();
            assertThat(span.getResource().getAttributes().toString()).doesNotContain(canary);
            assertThat(span.getInstrumentationScopeInfo().getName()).isEqualTo("sc-framework");
        }
    }
}
