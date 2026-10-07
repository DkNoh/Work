package dev.scframework.autoconfigure.messaging;

import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** 고정 종류의 counter만 제공한다. event/user/requestId를 metric label로 쓰지 않는다. */
public final class MessageDiagnostics {
    private static final Logger LOG = LoggerFactory.getLogger(MessageDiagnostics.class);
    private final AtomicLong published = new AtomicLong(), completed = new AtomicLong(), duplicates = new AtomicLong(), failed = new AtomicLong();
    public void published() { published.incrementAndGet(); }
    public void completed() { completed.incrementAndGet(); }
    public void duplicate() { duplicates.incrementAndGet(); }
    public void failed() { failed.incrementAndGet(); LOG.warn("Operational message failure; reasonCode=MESSAGE_OPERATION_FAILURE"); }
    public long getPublished() { return published.get(); } public long getCompleted() { return completed.get(); }
    public long getDuplicates() { return duplicates.get(); } public long getFailures() { return failed.get(); }
}
