package dev.scframework.autoconfigure.observability;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.operations.OperationalEvent;
import dev.scframework.core.operations.OperationalEventSink;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.tracing.Tracer;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;

/** 별도 bounded NDJSON만 수집한다. application.log와 요청·Throwable는 수집 대상이 아니다. */
public final class SafeOperationalEventSink implements OperationalEventSink {
    private final Path file;
    private final long limit;
    private final MeterRegistry meters;
    private final Tracer tracer;
    private final ObjectMapper mapper;
    private final io.opentelemetry.api.logs.Logger otlp;
    public SafeOperationalEventSink(Path file, long limit, MeterRegistry meters, Tracer tracer, ObjectMapper mapper) {
        this(file, limit, meters, tracer, mapper, null);
    }
    public SafeOperationalEventSink(Path file, long limit, MeterRegistry meters, Tracer tracer, ObjectMapper mapper,
            io.opentelemetry.api.logs.Logger otlp) {
        if (file == null || !file.isAbsolute() || limit < 4096 || limit > 100 * 1024 * 1024)
            throw new IllegalStateException("Observability log path or size is invalid");
        this.file = file.normalize(); this.limit = limit; this.meters = meters; this.tracer = tracer; this.mapper = mapper; this.otlp = otlp;
        try {
            for (Path current = this.file.getParent(); current != null; current = current.getParent())
                if (Files.isSymbolicLink(current)) throw new IllegalStateException("Observability log symlink is forbidden");
            Files.createDirectories(this.file.getParent());
            if (Files.isSymbolicLink(this.file)) throw new IllegalStateException("Observability log symlink is forbidden");
            if (!Files.exists(this.file, LinkOption.NOFOLLOW_LINKS)) Files.createFile(this.file);
            privateFile(this.file);
        } catch (IOException error) { throw new IllegalStateException("Could not prepare observability event log"); }
    }
    @Override public synchronized void record(OperationalEvent event) {
        try {
            meters.counter("sc.operations.events", "kind", event.kind().name(), "outcome", event.outcome().name()).increment();
            var json = mapper.createObjectNode();
            json.put("timestamp", Instant.now().toString()); json.put("kind", event.kind().name()); json.put("outcome", event.outcome().name());
            if (event.eventId() != null) json.put("eventId", event.eventId().toString());
            if (tracer != null && tracer.currentSpan() != null) {
                json.put("traceId", tracer.currentSpan().context().traceId());
                json.put("spanId", tracer.currentSpan().context().spanId());
            }
            String body = mapper.writeValueAsString(json);
            if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) throw new IOException("Unsafe log file");
            if (otlp != null) otlp.logRecordBuilder().setTimestamp(Instant.now())
                    .setSeverity(io.opentelemetry.api.logs.Severity.INFO).setBody(body).emit();
            byte[] line = (body + "\n").getBytes(StandardCharsets.UTF_8);
            if (Files.size(file) + line.length > limit) rotate();
            Files.write(file, line, StandardOpenOption.APPEND);
        } catch (RuntimeException | IOException error) {
            // 로그 내용과 예외 message를 재로깅하지 않는다. 원 업무·HTTP 결과는 유지한다.
            meters.counter("sc.operations.observability.failures").increment();
        }
    }
    private void rotate() throws IOException {
        for (int i = 3; i >= 1; i--) {
            Path previous = i == 1 ? file : file.resolveSibling(file.getFileName() + "." + (i - 1));
            Path next = file.resolveSibling(file.getFileName() + "." + i);
            if (Files.isSymbolicLink(previous) || Files.isSymbolicLink(next)) throw new IOException("Unsafe log file");
            if (Files.exists(previous) && !Files.isRegularFile(previous, LinkOption.NOFOLLOW_LINKS)) throw new IOException("Unsafe log file");
            if (Files.exists(next) && !Files.isRegularFile(next, LinkOption.NOFOLLOW_LINKS)) throw new IOException("Unsafe log file");
            if (Files.exists(previous)) Files.move(previous, next, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        Files.createFile(file); privateFile(file);
    }
    private static void privateFile(Path file) throws IOException {
        if (Files.getFileStore(file).supportsFileAttributeView("posix"))
            Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
    }
}
