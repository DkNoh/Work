// 요구사항 화면끼리 공유하는 Query 키와 사용자/메뉴 lookup composable이다.
// composable은 setup에서 호출하는 상태/기능 묶음이고, 여기서는 서버 자료를 Query 캐시에 유지한다.
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useReferenceRuntime } from "../../auth/identity";
import { createRequirementsApi } from "./api";

// 배열 키의 접두사 lists는 여러 검색 조건의 목록을 한 번에 무효화한다. 상세는 ID마다 분리된다.
export const requirementKeys = {
  all: ["requirements"] as const,
  lists: ["requirements", "list"] as const,
  detail: (id: number | null) => ["requirements", "detail", id] as const,
  users: ["requirement-users"] as const,
  menus: ["requirement-menus"] as const,
};
// 인증 상태일 때만 두 GET을 활성화한다. enabled는 computed라 로그아웃 시에도 조건이 재평가된다.
export function useRequirementLookups() {
  const runtime = useReferenceRuntime();
  const api = createRequirementsApi(runtime);
  const enabled = computed(() => !!runtime.session.identity);
  // 조회 함수의 signal을 API까지 연결한다. data/error/isPending은 ref이므로 script에서는 .value로 읽는다.
  const users = useQuery({
    queryKey: requirementKeys.users,
    queryFn: ({ signal }) => api.users(signal),
    enabled,
  });
  const menus = useQuery({
    queryKey: requirementKeys.menus,
    queryFn: ({ signal }) => api.menus(signal),
    enabled,
  });
  return { users, menus };
}
