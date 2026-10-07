package dev.scframework.starter.operations;

import dev.scframework.autoconfigure.messaging.JdbcMessageStore;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

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
