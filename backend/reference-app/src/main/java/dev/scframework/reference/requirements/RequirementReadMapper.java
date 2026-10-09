package dev.scframework.reference.requirements;

import java.time.Instant;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import org.mapstruct.ReportingPolicy;
import static dev.scframework.reference.requirements.RequirementDtos.*;

/**
 * MapStruct의 컴파일 시 DTO 변환기다. 이름에 ReadMapper가 있지만 MyBatis SQL Mapper가 아니다.
 * Service가 조회한 이름/관계를 인수로 받아 명시적으로 조립하고 누락 target은 빌드 오류로 잡는다.
 */

/** 조회 DTO만 변환한다. 권한·이름 조회·쓰기·revision은 Service가 결정한다. */
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface RequirementReadMapper {
    // Service가 배치 조회한 표시 이름을 별도 인수로 주입한다. 변환기 안에서 DB를 조회하면 숨은 N+1이 생기므로 조회 책임을 넣지 않는다.
    @Mapping(target = "menuName", source = "menuName")
    @Mapping(target = "authorName", source = "authorName")
    @Mapping(target = "assignedReviewerName", source = "assignedReviewerName")
    @Mapping(target = "createdAt", source = "request.createdAt", qualifiedByName = "utcInstant")
    @Mapping(target = "updatedAt", source = "request.updatedAt", qualifiedByName = "utcInstant")
    RequirementSummary summary(RequirementEntity request, String menuName, String authorName, String assignedReviewerName);

    @Mapping(target = "reviewerName", source = "reviewerName")
    @Mapping(target = "updatedAt", source = "review.updatedAt", qualifiedByName = "utcInstant")
    ReviewResponse review(ReviewEntity review, String reviewerName);

    @Mapping(target = "authorName", source = "authorName")
    @Mapping(target = "createdAt", source = "comment.createdAt", qualifiedByName = "utcInstant")
    CommentResponse comment(CommentEntity comment, String authorName);

    @Mapping(target = "actorName", source = "actorName")
    @Mapping(target = "createdAt", source = "history.createdAt", qualifiedByName = "utcInstant")
    HistoryResponse history(HistoryEntity history, String actorName);

    // 이름이 겹치는 여러 입력 객체에서 어느 필드를 사용할지 명시한다. 상세 관계는 이미 권한 확인한 Service의 인수만 연결한다.
    @Mapping(target = "id", source = "summary.id")
    @Mapping(target = "menuId", source = "summary.menuId")
    @Mapping(target = "menuName", source = "summary.menuName")
    @Mapping(target = "title", source = "summary.title")
    @Mapping(target = "desired", source = "summary.desired")
    @Mapping(target = "reason", source = "summary.reason")
    @Mapping(target = "referenceText", source = "summary.referenceText")
    @Mapping(target = "similar", source = "summary.similar")
    @Mapping(target = "followParts", source = "summary.followParts")
    @Mapping(target = "screenVersionId", source = "summary.screenVersionId")
    @Mapping(target = "status", source = "summary.status")
    @Mapping(target = "revision", source = "summary.revision")
    @Mapping(target = "authorId", source = "summary.authorId")
    @Mapping(target = "authorName", source = "summary.authorName")
    @Mapping(target = "assignedReviewerId", source = "summary.assignedReviewerId")
    @Mapping(target = "assignedReviewerName", source = "summary.assignedReviewerName")
    @Mapping(target = "createdAt", source = "summary.createdAt")
    @Mapping(target = "updatedAt", source = "summary.updatedAt")
    @Mapping(target = "review", source = "review")
    @Mapping(target = "comments", source = "comments")
    @Mapping(target = "history", source = "history")
    @Mapping(target = "annotation", source = "annotation")
    @Mapping(target = "screenVersion", source = "screenVersion")
    @Mapping(target = "attachments", source = "attachments")
    @Mapping(target = "ado", source = "ado")
    RequirementDetail detail(RequirementSummary summary, ReviewResponse review,
            List<CommentResponse> comments, List<HistoryResponse> history, AnnotationResponse annotation,
            ScreenVersionResponse screenVersion, List<AttachmentResponse> attachments, AdoResponse ado);

    // 일반 텍스트 요구사항을 위한 호환 overload다. 미디어 관계는 null/빈 첨부 배열로 채운다.
    default RequirementDetail detail(RequirementSummary summary, ReviewResponse review,
            List<CommentResponse> comments, List<HistoryResponse> history) {
        return detail(summary,review,comments,history,null,null,List.of(),null);
    }

    // 서버 시각은 UTC 원문 문자열로 반환한다. Asia/Seoul 등 표시 시간대 변환은 프런트 날짜 패키지의 책임이다.
    @Named("utcInstant")
    default String utcInstant(Instant value) { return value == null ? null : value.toString(); }
}
