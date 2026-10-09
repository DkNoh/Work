package dev.scframework.core.storage;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

/*
 * 일반 파일 SPI에 미완료 쓰기 journal 조회/확정 기능을 더한다.
 * PendingWrite의 currentRun은 현재 프로세스가 아직 쓰는 파일을 복구기가 제거하지 않도록 구분한다.
 * markRetained는 보존이 결정된 키의 marker를 정리하며 실제 업무 DB 참조 검사는 FileReferenceLookup에 남긴다.
 */

/** 복구에 필요한 opaque 식별자만 공개하며 내부 경로를 노출하지 않는다. */
public interface RecoverableFileStorage extends FileStorage {
    record PendingWrite(String key, String runId, Instant startedAt, boolean currentRun) { }
    List<PendingWrite> pendingWrites() throws IOException;
    void markRetained(String key) throws IOException;
}
