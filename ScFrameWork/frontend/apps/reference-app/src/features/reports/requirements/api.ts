import type { FrameworkRuntime } from "@sc/runtime";
import type { components, operations } from "../../../generated/api";
import type { ReferenceIdentity } from "../../../auth/identity";
import type { RequirementReportFilters } from "./filters";

export type RequirementReportItem = components["schemas"]["RequirementReportItem"];
export type RequirementReportPage = components["schemas"]["RequirementReportPage"];
export type RequirementReportStats = components["schemas"]["RequirementReportStats"];
type ReportApiQuery = NonNullable<operations["requirementReport"]["parameters"]["query"]>;

/** 공백·%·_도 검색어의 일부다. URL 인코딩만 하고 trim/SQL escape를 화면에서 하지 않는다. */
export function reportSearchParams(filters: RequirementReportFilters): URLSearchParams {
  const parameters: ReportApiQuery = { page: filters.page, size: filters.size };
  if (filters.q) parameters.q = filters.q;
  if (filters.menuId !== null) parameters.menuId = filters.menuId;
  if (filters.status) parameters.status = filters.status;
  if (filters.authorId !== null) parameters.authorId = filters.authorId;
  if (filters.screenVersionId !== null) parameters.screenVersionId = filters.screenVersionId;
  if (filters.sort !== null && filters.direction !== null) {
    parameters.sort = filters.sort;
    parameters.direction = filters.direction;
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  return query;
}

export function createRequirementReportsApi(runtime: FrameworkRuntime<ReferenceIdentity>) {
  return {
    list: (filters: RequirementReportFilters, signal?: AbortSignal) =>
      runtime.client.request<RequirementReportPage>(
        `/reports/requirements?${reportSearchParams(filters)}`,
        "GET",
        undefined,
        { signal },
      ),
  };
}
