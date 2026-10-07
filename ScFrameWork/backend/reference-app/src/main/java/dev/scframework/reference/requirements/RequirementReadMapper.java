package dev.scframework.reference.requirements;

import java.time.Instant;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import org.mapstruct.ReportingPolicy;
import static dev.scframework.reference.requirements.RequirementDtos.*;

/** 조회 DTO만 변환한다. 권한·이름 조회·쓰기·revision은 Service가 결정한다. */
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface RequirementReadMapper {
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

    default RequirementDetail detail(RequirementSummary summary, ReviewResponse review,
            List<CommentResponse> comments, List<HistoryResponse> history) {
        return detail(summary,review,comments,history,null,null,List.of(),null);
    }

    @Named("utcInstant")
    default String utcInstant(Instant value) { return value == null ? null : value.toString(); }
}
