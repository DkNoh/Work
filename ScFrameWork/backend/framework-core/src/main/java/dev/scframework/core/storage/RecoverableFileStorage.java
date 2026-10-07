package dev.scframework.core.storage;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

/** 복구에 필요한 opaque 식별자만 공개하며 내부 경로를 노출하지 않는다. */
public interface RecoverableFileStorage extends FileStorage {
    record PendingWrite(String key, String runId, Instant startedAt, boolean currentRun) { }
    List<PendingWrite> pendingWrites() throws IOException;
    void markRetained(String key) throws IOException;
}
