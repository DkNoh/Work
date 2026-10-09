package dev.scframework.starter.operations;

import dev.scframework.autoconfigure.messaging.JdbcMessageStore;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/*
 * 관리 화면에 outbox의 상태/시각/시도 수만 공개하는 DTO 모음이다. payload 본문은 내보내지 않는다.
 * from은 JDBC 상태 행을 공개 record로 복사하며 Page는 목록과 페이지 메타데이터를 묶는다.
 * @Schema는 OpenAPI 타입/nullable 설명이다. EmptyCommand는 추가 업무 입력 없이 실행하는 명령의 계약이다.
 */

public final class OperationMessageDtos {
    private OperationMessageDtos(){}
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
    public record EmptyCommand(){}
}
