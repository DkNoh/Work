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
