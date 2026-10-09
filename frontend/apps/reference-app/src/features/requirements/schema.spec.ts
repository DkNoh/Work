import { describe, expect, it } from "vitest";
import { requirementSchema, reviewSchema } from "./schema";
describe("requirement draft validation", () => {
  const body = {
    title: "  원문 제목  ",
    menuId: "1",
    desired: "동작",
    reason: "이유",
    referenceText: "",
    similar: false,
    followParts: "",
  };
  it("validates whitespace without changing submitted source text", () => {
    expect(requirementSchema.parse(body).title).toBe("  원문 제목  ");
    expect(requirementSchema.safeParse({ ...body, title: " \n " }).success).toBe(false);
    expect(requirementSchema.safeParse({ ...body, menuId: null }).success).toBe(false);
  });
  it("requires reuse details only when similar functionality is selected", () => {
    expect(requirementSchema.safeParse({ ...body, similar: true }).success).toBe(false);
    expect(
      requirementSchema.safeParse({ ...body, similar: true, followParts: "검색 조건" }).success,
    ).toBe(true);
  });
  it("keeps needsInfo independent of review decision and permits empty agreement fields before agreement", () => {
    const review = {
      decision: "POSSIBLE",
      rationale: "가능한 근거",
      conditions: "",
      scope: "",
      exclusions: "",
      acceptance: "",
      estimate: "UNKNOWN",
      needsInfo: true,
    };
    expect(reviewSchema.parse(review)).toEqual(review);
    expect(reviewSchema.safeParse({ ...review, rationale: " " }).success).toBe(false);
  });
});
