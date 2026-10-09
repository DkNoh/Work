package dev.scframework.reference.operations.messages;

import dev.scframework.autoconfigure.messaging.JdbcMessageStore;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 운영 메시지의 상태·횟수·시각·제한된 오류 코드만 공개한다. payload/저장 경로/예외 원문은 반환하지 않는다.
 */

public final class OperationMessageDtos {
    private OperationMessageDtos(){}
    // 비동기 처리 상태만 반환한다. nextAttemptAt/publishedAt/completedAt을 구분해야 접수와 전달/완료를 혼동하지 않는다.
    public record OperationMessageItem(
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,format="uuid") UUID eventId,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"SECURITY_AUDIT","FILE_DELETE","MESSAGE_DEMO"}) String type,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) JdbcMessageStore.State state,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0",maximum="5") int dispatchAttempts,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,format="date-time") Instant nextAttemptAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,format="date-time") Instant createdAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,nullable=true,format="date-time") Instant publishedAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,nullable=true,format="date-time") Instant completedAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,nullable=true,maxLength=32) String lastFailureCode
    ){ public static OperationMessageItem from(JdbcMessageStore.Status row){return new OperationMessageItem(row.eventId(),row.type(),row.state(),row.dispatchAttempts(),row.nextAttemptAt(),row.createdAt(),row.publishedAt(),row.completedAt(),row.lastFailureCode());} }
    public record OperationMessagePage(
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<OperationMessageItem> items,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0") long total,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0",maximum="1000000") int page,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1",maximum="100") int size
    ){}
    // 요청 본문 없음 또는 빈 명령에 대응한다. 데모/재시도 API에 사용자 payload를 받는 필드를 추가하지 않는다.
    public record EmptyCommand(){}
}
