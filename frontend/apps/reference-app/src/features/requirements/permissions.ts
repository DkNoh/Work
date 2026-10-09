// 요구사항 화면에서 버튼/폼을 보여 줄지 계산하는 순수 함수다. 서버 Service의 최종 권한·상태 전이 검사를 대신하지 않는다.
// ReferenceIdentity | null은 로그인 정보가 없는 경우까지 포함하는 union 타입이다. !!는 존재 여부를 boolean으로 만든다.
import type { ReferenceIdentity } from "../../auth/identity";
import type { RequirementDetail } from "./api";

export function requirementPermissions(item: RequirementDetail, actor: ReferenceIdentity | null) {
  const author = !!actor && actor.id === item.authorId;
  // 검토 역할이 있어도 현재 지정 담당자여야 하며 작성자 본인은 검토할 수 없다. DRAFT는 검토 이전 단계다.
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
    // 합의 버튼은 현재 담당자의 가능한 검토 및 범위·제외·인수 기준이 모두 존재할 때만 표시한다.
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
