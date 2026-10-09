/**
 * 요구사항 보고서 GET API의 타입/파라미터 경계. generated/api는 서버 OpenAPI에서 생성하므로 이 파일에서 응답 타입을 중복 정의하지 않는다.
 * NonNullable<T>는 nullable/undefined를 제거하는 TypeScript 유틸리티 타입이다. 실제 HTTP 값의 유효성은 필터 파서와 서버가 확인한다.
 * URLSearchParams는 브라우저 표준 인코더다. 화면에서 SQL escape나 검색어 trim을 수행하면 서버 검색 계약과 다른 결과가 생길 수 있다.
 */
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

/**
 * 조회 취소용 AbortSignal을 공통 client까지 전달한다. queryKey가 바뀌거나 요청이 취소될 때 이전 네트워크 작업을 정리할 수 있다.
 */
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
