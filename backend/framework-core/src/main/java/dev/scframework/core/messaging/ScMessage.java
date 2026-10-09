package dev.scframework.core.messaging;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.UUID;

/*
 * eventId로 재전달을 식별하고 type/schemaVersion으로 허용된 handler를 선택하는 메시지 봉투다.
 * 생성자에서 UTF-8 payload 크기와 코드/시각을 검사하며 업무별 payload 내용은 등록 handler가 검증한다.
 * toString을 별도로 정의해 진단 출력에 payload 원문이 들어가지 않게 한다.
 */

/** 등록 codec으로 검증하는 중립 메시지. 본문을 toString/log에 출력하지 않는다. */
public record ScMessage(UUID eventId, String type, int schemaVersion, Instant occurredAt, String payload) {
    public ScMessage {
        Objects.requireNonNull(eventId, "Message identity is required");
        if (type == null || !type.matches("[A-Z][A-Z0-9_]{0,63}") || schemaVersion != 1)
            throw new IllegalArgumentException("SC_MESSAGE_SCHEMA_INVALID");
        occurredAt = Objects.requireNonNull(occurredAt, "Message time is required").truncatedTo(ChronoUnit.MICROS);
        if (payload == null || payload.isEmpty() || payload.getBytes(StandardCharsets.UTF_8).length > 16384)
            throw new IllegalArgumentException("SC_MESSAGE_PAYLOAD_INVALID");
    }
    @Override public String toString() { return "ScMessage[eventId=" + eventId + ",type=" + type + ",schemaVersion=" + schemaVersion + "]"; }
}
