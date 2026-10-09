package dev.scframework.autoconfigure.browsererrors;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/*
 * 브라우저 수집 입력과 운영 조회 응답의 공개 DTO 모음이다. 원문 오류/URL/stack 필드는 없다.
 * @Schema는 OpenAPI 설명이며 실제 입력 허용 여부는 body filter와 BrowserErrorService가 검사한다.
 * Group은 고정 코드 조합별 집계, Occurrence는 실제 수집 이력, 각 Page는 페이지 메타데이터를 포함한다.
 */

/** 원문 오류·주소·스택 필드가 없는 중립 수집 계약이다. */
public final class BrowserErrorContracts {
    private BrowserErrorContracts(){}
    @Schema(name="BrowserErrorInput")
    public record Input(
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1",maximum="1",type="integer",format="int32") Integer schemaVersion,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,format="uuid") String clientEventId,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"VUE","WINDOW","REJECTION"}) String source,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"VUE_ERROR","WINDOW_ERROR","UNHANDLED_REJECTION","UNKNOWN_RUNTIME"}) String eventCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,maxLength=64,description="소비 앱에 설정한 현재 release version과 정확히 일치해야 합니다.") String appVersion,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,maxLength=64) String routeCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"ROOT"}) String componentCode){}
    @Schema(name="BrowserErrorAccepted") public record Accepted(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) boolean accepted){}
    @Schema(name="BrowserErrorGroupResponse")
    public record Group(
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) long id,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minLength=64,maxLength=64) String fingerprint,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String appVersion,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"VUE","WINDOW","REJECTION"}) String source,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"VUE_ERROR","WINDOW_ERROR","UNHANDLED_REJECTION","UNKNOWN_RUNTIME"}) String eventCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String routeCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"ROOT"}) String componentCode,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Instant firstSeenAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Instant lastSeenAt,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1") long occurrenceCount){}
    @Schema(name="BrowserErrorGroupPage")
    public record GroupPage(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<Group> items,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) long total,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0",maximum="1000000") int page,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1",maximum="100") int size){}
    @Schema(name="BrowserErrorOccurrenceResponse")
    public record Occurrence(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) long id,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) long groupId,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,nullable=true) Long actorId,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String actorSubject,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,nullable=true) String requestId,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Instant occurredAt){}
    @Schema(name="BrowserErrorOccurrencePage")
    public record OccurrencePage(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<Occurrence> items,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) long total,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="0",maximum="1000000") int page,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,minimum="1",maximum="100") int size){}
}
