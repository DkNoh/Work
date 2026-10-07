import type { ReferenceIdentity } from "../../auth/identity";
import type { RequirementDetail } from "./api";

export function requirementPermissions(item: RequirementDetail, actor: ReferenceIdentity | null) {
  const author = !!actor && actor.id === item.authorId;
  const canReview =
    !!actor &&
    (actor.role === "REVIEWER" || actor.role === "ADMIN") &&
    actor.id === item.assignedReviewerId &&
    !author &&
    item.status !== "DRAFT";
  const review = item.review;
  return {
    edit: author,
    assign: !!actor && (author || actor.role === "ADMIN"),
    submit: author && ["DRAFT", "NEEDS_INFO"].includes(item.status),
    review: canReview,
    agree:
      author &&
      item.status === "REVIEWING" &&
      !!review &&
      review.reviewerId === item.assignedReviewerId &&
      ["POSSIBLE", "CONDITIONAL"].includes(review.decision) &&
      !!review.scope.trim() &&
      !!review.exclusions.trim() &&
      !!review.acceptance.trim(),
  };
}
