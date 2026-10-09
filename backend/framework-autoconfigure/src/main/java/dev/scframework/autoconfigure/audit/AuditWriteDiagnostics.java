package dev.scframework.autoconfigure.audit;

import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/*
 * 감사 저장 실패 횟수와 고정 경고 코드를 제공한다. AtomicLong은 여러 요청 스레드의 증가를 안전하게 합산한다.
 * 실패 진단은 영속 재전송을 제공하지 않으며 오류 원문을 다시 로그에 복사하지 않는다.
 */

/** 동기 저장 실패의 운영 신호. 영구 전달/outbox 보장은 후속 운영 모듈의 책임이다. */
public final class AuditWriteDiagnostics {
    private static final Logger LOG = LoggerFactory.getLogger(AuditWriteDiagnostics.class);
    private final AtomicLong failedWrites = new AtomicLong();

    public long getFailedWrites() { return failedWrites.get(); }

    void failed() {
        failedWrites.incrementAndGet();
        // 예외 message/stack·SQL·사용자·원문을 로그에 복사하지 않는다.
        LOG.warn("Security audit write failed; reasonCode=AUDIT_SINK_FAILURE");
    }
}
