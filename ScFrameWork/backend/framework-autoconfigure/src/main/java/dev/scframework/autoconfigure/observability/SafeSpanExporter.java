package dev.scframework.autoconfigure.observability;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.sdk.common.CompletableResultCode;
import io.opentelemetry.sdk.common.InstrumentationScopeInfo;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.data.DelegatingSpanData;
import io.opentelemetry.sdk.trace.data.EventData;
import io.opentelemetry.sdk.trace.data.LinkData;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.trace.data.StatusData;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

/** OTLP 경계에서 allowlist로 다시 작성한다. 원문 URL·SQL·예외·baggage는 export하지 않는다. */
public final class SafeSpanExporter implements SpanExporter {
    private static final Set<String> METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS");
    private final SpanExporter delegate;
    private final Supplier<Set<String>> routes;
    private final Resource resource;
    public SafeSpanExporter(SpanExporter delegate, Supplier<Set<String>> routes, String application) {
        if (application == null || !application.matches("[a-z0-9-]{3,64}"))
            throw new IllegalStateException("Observability application name is invalid");
        this.delegate = delegate;
        this.routes = routes;
        this.resource = Resource.create(Attributes.of(AttributeKey.stringKey("service.name"), application));
    }
    public SpanData sanitize(SpanData original) {
        var builder = Attributes.builder();
        String method = original.getAttributes().get(AttributeKey.stringKey("http.request.method"));
        if (method == null) method = original.getAttributes().get(AttributeKey.stringKey("http.method"));
        if (method == null) method = original.getAttributes().get(AttributeKey.stringKey("method"));
        if (METHODS.contains(method == null ? "" : method)) builder.put("http.request.method", method);
        String route = original.getAttributes().get(AttributeKey.stringKey("http.route"));
        if (route == null) route = original.getAttributes().get(AttributeKey.stringKey("uri"));
        if (route != null && routes.get().contains(route)) builder.put("http.route", route);
        Long status = original.getAttributes().get(AttributeKey.longKey("http.response.status_code"));
        if (status == null) status = original.getAttributes().get(AttributeKey.longKey("http.status_code"));
        if (status == null) {
            String observed = original.getAttributes().get(AttributeKey.stringKey("status"));
            if (observed != null && observed.matches("[1-5][0-9]{2}")) status = Long.valueOf(observed);
        }
        if (status != null && status >= 100 && status <= 599) builder.put("http.response.status_code", status);
        if (original.getStatus().getStatusCode() == StatusCode.ERROR) builder.put("error.type", "ERROR");
        Attributes safe = builder.build();
        return new DelegatingSpanData(original) {
            @Override public String getName() { return "SC " + original.getKind().name(); }
            @Override public Attributes getAttributes() { return safe; }
            @Override public Resource getResource() { return resource; }
            @Override public StatusData getStatus() { return StatusData.create(original.getStatus().getStatusCode(), ""); }
            @Override public List<EventData> getEvents() { return List.of(); }
            @Override public List<LinkData> getLinks() { return List.of(); }
            @Override public int getTotalRecordedEvents() { return 0; }
            @Override public int getTotalRecordedLinks() { return 0; }
            @Override public int getTotalAttributeCount() { return safe.size(); }
            @Override public InstrumentationScopeInfo getInstrumentationScopeInfo() {
                return InstrumentationScopeInfo.create("sc-framework");
            }
            @Override @SuppressWarnings("deprecation")
            public io.opentelemetry.sdk.common.InstrumentationLibraryInfo getInstrumentationLibraryInfo() {
                return io.opentelemetry.sdk.common.InstrumentationLibraryInfo.create("sc-framework", "0.3.0");
            }
        };
    }
    @Override public CompletableResultCode export(Collection<SpanData> spans) {
        return delegate.export(spans.stream().map(this::sanitize).toList());
    }
    @Override public CompletableResultCode flush() { return delegate.flush(); }
    @Override public CompletableResultCode shutdown() { return delegate.shutdown(); }
}
