/**
 * 보고서 URL 문자열과 폼 초안을 검증된 조회 조건으로 변환한다. Java의 요청 파라미터 바인딩/검증을 브라우저 화면에 맞게 수행하는 경계다.
 * as const는 상태 배열을 문자열[] 대신 정확한 리터럴 tuple로 고정하고, satisfies는 원래 추론을 유지하면서 서버 상태 타입과 맞는지 검사한다.
 * (typeof 배열)[number]는 배열 요소의 union 타입을 만든다. readonly는 코드에서의 대입을 제한하며 Java 불변 객체를 생성하는 기능은 아니다.
 * 잘못된 URL은 errors와 함께 반환하여 조회 자체를 막는다. 반환된 기본값을 조용히 정상 검색 조건으로 취급하면 안 된다.
 */
import { z } from "zod";
import type { RequirementReportItem } from "./api";

export const reportStatuses = [
  "DRAFT",
  "REQUESTED",
  "NEEDS_INFO",
  "REVIEWING",
  "AGREED",
  "ADO_LINKED",
] as const satisfies readonly RequirementReportItem["status"][];
export const reportSortFields = [
  "updatedAt",
  "title",
  "commentCount",
  "historyCount",
  "lastCommentAt",
] as const;
export type ReportSortField = (typeof reportSortFields)[number];
export type ReportDirection = "asc" | "desc";
export type ReportView = "table" | "virtual";
export interface RequirementReportFilters {
  readonly q: string;
  readonly menuId: number | null;
  readonly status: (typeof reportStatuses)[number] | "";
  readonly authorId: number | null;
  readonly screenVersionId: number | null;
  readonly page: number;
  readonly size: number;
  readonly sort: ReportSortField | null;
  readonly direction: ReportDirection | null;
}
export interface ParsedReportQuery {
  readonly filters: RequirementReportFilters;
  readonly view: ReportView;
  readonly errors: Readonly<Record<string, string>>;
}
export function isReportSortField(value: unknown): value is ReportSortField {
  return typeof value === "string" && reportSortFields.some((field) => field === value);
}

/** 적용 조건은 URL 하나에서 읽는다. 잘못된 URL을 다른 검색어로 잘라서 조회하지 않는다. */
/**
 * 배열/중복 값·허용하지 않은 상태/정렬·범위 밖 정수를 모두 오류로 분리한다. number의 안전한 정수 범위는 Java long 전체 범위와 다르다.
 */
export function parseReportQuery(query: Readonly<Record<string, unknown>>): ParsedReportQuery {
  const errors: Record<string, string> = {};
  function text(name: string, fallback = "") {
    const value = query[name];
    if (value === undefined || value === null) return fallback;
    if (typeof value !== "string") {
      errors[name] = "singleValue";
      return fallback;
    }
    return value;
  }
  function integer(name: string, fallback: number | null, minimum: number, maximum: number) {
    if (query[name] === undefined) return fallback;
    const value = text(name);
    const parsed = Number(value);
    if (
      !/^[0-9]+$/.test(value) ||
      !Number.isSafeInteger(parsed) ||
      parsed < minimum ||
      parsed > maximum
    ) {
      errors[name] ??=
        minimum === 1 && maximum === Number.MAX_SAFE_INTEGER ? "positiveId" : "integer";
      return fallback;
    }
    return parsed;
  }
  const q = text("q");
  if (q.length > 200) errors.q = "tooLong";
  const rawStatus = text("status");
  const status = reportStatuses.find((value) => value === rawStatus) ?? "";
  if (rawStatus && !status) errors.status = "status";
  const rawSort = text("sort");
  const sort = isReportSortField(rawSort) ? rawSort : null;
  if (query.sort !== undefined && sort === null) errors.sort ??= "sort";
  const rawDirection = text("direction");
  if (query.direction !== undefined && rawDirection !== "asc" && rawDirection !== "desc")
    errors.direction ??= "direction";
  if (query.direction !== undefined && !rawSort) errors.direction ??= "directionWithoutSort";
  const direction = sort === null ? null : rawDirection === "asc" ? "asc" : "desc";
  const rawView = text("view", "table");
  if (rawView !== "table" && rawView !== "virtual") errors.view = "view";
  const filters: RequirementReportFilters = {
    q,
    menuId: integer("menuId", null, 1, Number.MAX_SAFE_INTEGER),
    status,
    authorId: integer("authorId", null, 1, Number.MAX_SAFE_INTEGER),
    screenVersionId: integer("screenVersionId", null, 1, Number.MAX_SAFE_INTEGER),
    page: integer("page", 0, 0, 1_000_000) ?? 0,
    size: integer("size", 20, 1, 100) ?? 20,
    sort,
    direction,
  };
  return { filters, view: rawView === "virtual" ? "virtual" : "table", errors };
}

/**
 * 빈 선택은 null, 유효한 숫자 문자열은 number로 변환한다. superRefine은 여러 조건을 검사하는 Zod 실행 코드다.
 */
const optionalId = z
  .union([z.string(), z.null()])
  .superRefine((value, context) => {
    if (value === null || value === "") return;
    const parsed = Number(value);
    if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1)
      context.addIssue({ code: "custom", message: "positiveId" });
  })
  .transform((value) => (value === null || value === "" ? null : Number(value)));
export const reportFilterSchema = z.object({
  q: z.string().max(200, { message: "tooLong" }),
  menuId: optionalId,
  status: z
    .union([z.enum(reportStatuses), z.literal(""), z.null()])
    .transform((value) => value ?? ""),
  authorId: optionalId,
  size: z
    .union([z.string(), z.null()])
    .superRefine((value, context) => {
      const parsed = Number(value);
      if (
        typeof value !== "string" ||
        !/^[0-9]+$/.test(value) ||
        !Number.isSafeInteger(parsed) ||
        parsed < 1 ||
        parsed > 100
      )
        context.addIssue({ code: "custom", message: "integer" });
    })
    .transform(Number),
});
/** 입력 중의 선택값은 문자열이다. 제출 시 Zod가 API에 보낼 허용값·숫자로 좁힌다. */
export interface ReportFilterDraft {
  q: string;
  menuId: string | null;
  status: string | null;
  authorId: string | null;
  size: string | null;
}
export type ReportFilterInput = z.output<typeof reportFilterSchema>;

/**
 * 검증된 조건을 다시 URL용 문자열로 직렬화한다. 생략 가능한 기본값을 줄이되 검색어와 명시 정렬 의미는 보존한다.
 */
export function reportRouteQuery(filters: RequirementReportFilters, view: ReportView) {
  const query: Record<string, string> = { page: String(filters.page), size: String(filters.size) };
  if (filters.q) query.q = filters.q;
  if (filters.menuId !== null) query.menuId = String(filters.menuId);
  if (filters.status) query.status = filters.status;
  if (filters.authorId !== null) query.authorId = String(filters.authorId);
  if (filters.screenVersionId !== null) query.screenVersionId = String(filters.screenVersionId);
  if (filters.sort !== null && filters.direction !== null) {
    query.sort = filters.sort;
    query.direction = filters.direction;
  }
  if (view === "virtual") query.view = "virtual";
  return query;
}
