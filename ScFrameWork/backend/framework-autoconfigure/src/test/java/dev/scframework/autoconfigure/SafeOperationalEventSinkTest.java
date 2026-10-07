package dev.scframework.autoconfigure;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.autoconfigure.observability.SafeOperationalEventSink;
import dev.scframework.core.operations.OperationalEvent;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.io.TempDir;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SafeOperationalEventSinkTest {
    @TempDir Path folder;
    @BeforeEach void canonicalTemporaryFolder() throws Exception { folder = folder.toRealPath(); }
    @Test void boundedPrivateLogsRetainSafeCodesAndMetricsNeverUseEventIds() throws Exception {
        var meters = new SimpleMeterRegistry(); var path = folder.resolve("events.ndjson");
        var sink = new SafeOperationalEventSink(path, 4096, meters, null, new ObjectMapper());
        UUID id = UUID.randomUUID();
        for (int i = 0; i < 160; i++) sink.record(new OperationalEvent(
                OperationalEvent.Kind.MESSAGE_CONSUME, OperationalEvent.Outcome.SUCCESS, id));
        try (var files = Files.list(folder)) {
            var logs = files.toList(); assertThat(logs).hasSize(4);
            for (var log : logs) {
                assertThat(Files.size(log)).isLessThanOrEqualTo(4096);
                for (String line : Files.readAllLines(log)) {
                    var json = new ObjectMapper().readTree(line);
                    var keys = new java.util.ArrayList<String>(); json.fieldNames().forEachRemaining(keys::add);
                    assertThat(keys).containsExactlyInAnyOrder("timestamp", "kind", "outcome", "eventId");
                    assertThat(json.path("eventId").asText()).isEqualTo(id.toString());
                }
                if (Files.getFileStore(log).supportsFileAttributeView("posix"))
                    assertThat(java.nio.file.attribute.PosixFilePermissions.toString(Files.getPosixFilePermissions(log))).isEqualTo("rw-------");
            }
        }
        assertThat(meters.get("sc.operations.events").tags("kind", "MESSAGE_CONSUME", "outcome", "SUCCESS").counter().count()).isEqualTo(160);
        assertThat(meters.getMeters()).allSatisfy(meter -> assertThat(meter.getId().getTags()).allSatisfy(tag -> assertThat(tag.getValue()).isNotEqualTo(id.toString())));
    }
    @Test void ioFailureDoesNotChangeTheCallingBusinessResult() throws Exception {
        var meters = new SimpleMeterRegistry(); var path = folder.resolve("events.ndjson");
        var sink = new SafeOperationalEventSink(path, 4096, meters, null, new ObjectMapper());
        Files.delete(path); Files.createDirectory(path);
        sink.record(new OperationalEvent(OperationalEvent.Kind.FILE_RECOVERY, OperationalEvent.Outcome.FAILURE, null));
        assertThat(meters.get("sc.operations.observability.failures").counter().count()).isEqualTo(1);
    }
    @Test void rejectsSymlinksBeforeWritingAnything() throws Exception {
        Path outside = folder.resolve("outside"); Files.writeString(outside, "private fixture");
        Path link = folder.resolve("events.ndjson"); Files.createSymbolicLink(link, outside);
        assertThatThrownBy(() -> new SafeOperationalEventSink(link,4096,new SimpleMeterRegistry(),null,new ObjectMapper()))
                .isInstanceOf(IllegalStateException.class);
        assertThat(Files.readString(outside)).isEqualTo("private fixture");
    }
}
