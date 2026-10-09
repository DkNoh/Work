package dev.scframework.core.operations;

import java.util.UUID;

/*
 * 관측 지표/로그에 전달할 등록 종류·결과와 선택 eventId를 표현한다.
 * enum으로 종류와 결과 집합을 제한해 예외 메시지나 URL을 metric label로 전달하지 않게 한다.
 */

/** 관측 자료에는 등록 코드와 opaque event ID만 넣는다. 예외·요청 원문은 받지 않는다. */
public record OperationalEvent(Kind kind, Outcome outcome, UUID eventId) {
    public OperationalEvent {
        java.util.Objects.requireNonNull(kind, "kind");
        java.util.Objects.requireNonNull(outcome, "outcome");
    }
    public enum Kind { HTTP_REQUEST, MESSAGE_DISPATCH, MESSAGE_CONSUME, MESSAGE_DEAD, FILE_RECOVERY,
        SCHEDULE_RUN, BROWSER_ERROR_ACCEPTED, BROWSER_ERROR_REJECTED }
    public enum Outcome { SUCCESS, FAILURE, DUPLICATE, RETRY, DEAD }
}
