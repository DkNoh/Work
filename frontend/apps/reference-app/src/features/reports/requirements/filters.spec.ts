import { describe, expect, it } from "vitest";
import { reportSearchParams } from "./api";
import { parseReportQuery, reportFilterSchema, reportRouteQuery } from "./filters";

describe("요구사항 보고서 URL·검색 원본", () => {
  it("공백·LIKE 특수문자·인용부호 검색과 페이지를 URL/API 왕복에서 보존한다", () => {
    const q = "  %_ '한글' \\\"  ";
    const input = Object.freeze({
      q,
      menuId: "3",
      status: "REQUESTED",
      authorId: "4",
      screenVersionId: "9",
      page: "50",
      size: "100",
      view: "virtual",
    });
    const parsed = parseReportQuery(input);
    expect(parsed.errors).toEqual({});
    expect(parsed.filters.q).toBe(q);
    const api = reportSearchParams(parsed.filters);
    expect(api.get("q")).toBe(q);
    expect(api.get("screenVersionId")).toBe("9");
    expect(api.get("page")).toBe("50");
    expect(api.has("view")).toBe(false);
    expect(api.has("sort")).toBe(false);
    expect(api.has("direction")).toBe(false);
    expect(parseReportQuery(reportRouteQuery(parsed.filters, parsed.view))).toEqual(parsed);
    expect(input.q).toBe(q);
  });

  it("기본 정렬은 null로 유지하고 sort 단독은 desc, direction 단독은 오류로 처리한다", () => {
    const defaults = parseReportQuery({});
    expect(defaults.filters.sort).toBeNull();
    expect(defaults.filters.direction).toBeNull();
    const explicit = parseReportQuery({ sort: "lastCommentAt" });
    expect(explicit.errors).toEqual({});
    expect(explicit.filters.direction).toBe("desc");
    expect(reportSearchParams(explicit.filters).get("direction")).toBe("desc");
    expect(parseReportQuery({ direction: "asc" }).errors.direction).toBe("directionWithoutSort");
    expect(parseReportQuery({ sort: "title; DROP TABLE requirement" }).errors.sort).toBe("sort");
    expect(parseReportQuery({ sort: "title", direction: "ASC" }).errors.direction).toBe(
      "direction",
    );
  });

  it("범위를 벗어난 조건·중복 파라미터를 거절하고 긴 검색어를 잘라서 조회하지 않는다", () => {
    const q = "한".repeat(201);
    const parsed = parseReportQuery({
      q,
      menuId: "0",
      authorId: "-1",
      screenVersionId: "1.5",
      page: "1000001",
      size: "101",
      view: "unknown",
    });
    expect(parsed.filters.q).toBe(q);
    expect(parsed.errors).toMatchObject({
      q: "tooLong",
      menuId: "positiveId",
      authorId: "positiveId",
      screenVersionId: "positiveId",
      page: "integer",
      size: "integer",
      view: "view",
    });
    expect(parseReportQuery({ q: ["first", "second"] }).errors.q).toBe("singleValue");
    expect(parseReportQuery({ page: "0", size: "1" }).errors).toEqual({});
    expect(parseReportQuery({ page: "1000000", size: "100" }).errors).toEqual({});
  });

  it("제출 전 폼도 같은 문자열 원본을 검증하고 허용한 숫자만 변환한다", () => {
    const q = " %_ 한글 ";
    const result = reportFilterSchema.safeParse({
      q,
      menuId: "3",
      status: "",
      authorId: null,
      size: "37",
    });
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data).toEqual({ q, menuId: 3, status: "", authorId: null, size: 37 });
    expect(
      reportFilterSchema.safeParse({ q, menuId: "1.2", status: "", authorId: "", size: "20" })
        .success,
    ).toBe(false);
    expect(
      reportFilterSchema.safeParse({
        q: "한".repeat(201),
        menuId: "",
        status: "",
        authorId: "",
        size: "20",
      }).success,
    ).toBe(false);
    expect(
      reportFilterSchema.safeParse({ q, menuId: "", status: "", authorId: "", size: "0" }).success,
    ).toBe(false);
  });
});
