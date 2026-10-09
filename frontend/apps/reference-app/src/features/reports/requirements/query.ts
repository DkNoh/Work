/**
 * 보고서 API를 Vue Query와 연결하는 composable. queryKey는 같은 조건의 서버 응답을 공유하는 캐시 식별자다.
 * 기존 requirementKeys.lists 아래에 보고서를 두어 요구사항 저장 시 목록 무효화가 보고서 집계까지 갱신하게 한다.
 * ComputedRef 입력을 받아 URL 조건 변경에 반응한다. queryFn은 요청을 시작한 키의 조건을 사용하고, 로그인/URL 유효성이 확보될 때만 실행한다.
 * 이전 페이지 placeholder를 새 페이지처럼 표시하지 않는다. Query는 브라우저 서버 상태 캐시이며 DB나 전역 업무 상태를 대체하지 않는다.
 */
import { computed, type ComputedRef } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useReferenceRuntime } from "../../../auth/identity";
import { requirementKeys } from "../../requirements/query";
import { createRequirementReportsApi } from "./api";
import type { RequirementReportFilters } from "./filters";

// 요구사항 저장 후 기존 lists prefix 무효화가 보고서와 집계를 함께 갱신한다.
export const requirementReportKeys = {
  list: (filters: RequirementReportFilters) =>
    [...requirementKeys.lists, "report", filters] as const,
};
export function useRequirementReport(
  filters: ComputedRef<RequirementReportFilters>,
  valid: ComputedRef<boolean>,
) {
  const runtime = useReferenceRuntime();
  const api = createRequirementReportsApi(runtime);
  return useQuery({
    queryKey: computed(() => requirementReportKeys.list(filters.value)),
    queryFn: ({ queryKey, signal }) => api.list(queryKey[3], signal),
    enabled: computed(() => Boolean(runtime.session.identity) && valid.value),
    // 이전 페이지를 새 URL의 전역 행 번호로 표시하지 않도록 placeholderData를 사용하지 않는다.
  });
}
