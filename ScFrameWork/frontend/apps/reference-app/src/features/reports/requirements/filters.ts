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
