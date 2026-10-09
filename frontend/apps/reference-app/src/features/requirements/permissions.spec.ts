import { describe, expect, it } from "vitest";
import { requirementPermissions } from "./permissions";
import type { RequirementDetail } from "./api";
import type { ReferenceIdentity } from "../../auth/identity";
const actor = (id: number, role: ReferenceIdentity["role"]): ReferenceIdentity => ({
  id,
  role,
  roles: [role],
  username: `user${id}`,
  displayName: `사용자 ${id}`,
});
const requirement: RequirementDetail = {
  id: 1,
  title: "요구사항",
  menuId: 1,
  menuName: "메뉴",
  desired: "동작",
  reason: "이유",
  referenceText: "",
  similar: 0,
  followParts: "",
  screenVersionId: null,
  status: "REQUESTED",
  revision: 2,
  authorId: 1,
  authorName: "작성자",
  assignedReviewerId: 2,
  assignedReviewerName: "담당자",
  createdAt: "2026-10-06T00:00:00Z",
  updatedAt: "2026-10-06T00:00:00Z",
  review: null,
  annotation: null,
  screenVersion: null,
  comments: [],
  history: [],
  attachments: [],
  ado: null,
};
describe("relationship-based requirement permissions", () => {
  it("does not give ADMIN another author's edit, submit, agree or unassigned review permissions", () => {
    expect(requirementPermissions({ ...requirement, status: "DRAFT" }, actor(3, "ADMIN"))).toEqual({
      edit: false,
      assign: true,
      submit: false,
      review: false,
      agree: false,
    });
    expect(requirementPermissions(requirement, actor(3, "ADMIN")).review).toBe(false);
    expect(requirementPermissions(requirement, actor(2, "REVIEWER")).review).toBe(true);
    expect(
      requirementPermissions({ ...requirement, status: "DRAFT" }, actor(2, "REVIEWER")).review,
    ).toBe(false);
  });
  it("requires a current assigned review and all three agreement fields", () => {
    const review = {
      requirementId: 1,
      decision: "POSSIBLE",
      rationale: "가능",
      conditions: "",
      scope: "범위",
      exclusions: "제외",
      acceptance: "기준",
      estimate: "UNKNOWN",
      reviewerId: 2,
      reviewerName: "담당자",
      updatedAt: "2026-10-06T00:00:00Z",
    };
    const item = { ...requirement, status: "REVIEWING", review } as RequirementDetail;
    expect(requirementPermissions(item, actor(1, "REQUESTER")).agree).toBe(true);
    expect(
      requirementPermissions(
        { ...item, review: { ...review, acceptance: " " } },
        actor(1, "REQUESTER"),
      ).agree,
    ).toBe(false);
    expect(
      requirementPermissions({ ...item, assignedReviewerId: 3 }, actor(1, "REQUESTER")).agree,
    ).toBe(false);
    expect(
      requirementPermissions({ ...item, status: "NEEDS_INFO" }, actor(1, "REQUESTER")).agree,
    ).toBe(false);
  });
});
