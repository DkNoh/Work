// 칸반의 서버 자료를 읽는 composable이다. 권한 조회 → 접근 허용/URL 유효성 확인 → 업무 조회의 순서를 구성한다.
import { computed, type ComputedRef } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useReferenceRuntime } from "../../auth/identity";
import { createKanbanApi, type KanbanFilters } from "./api";
// as const 키는 캐시 식별자다. all을 무효화하면 접근권한·보드·목록·상세 등 해당 접두사 조회가 갱신된다.
export const kanbanKeys = {
  all: ["kanban"] as const,
  access: ["kanban", "access"] as const,
  boards: ["kanban", "boards"] as const,
  users: ["kanban", "users"] as const,
  members: ["kanban", "members"] as const,
  lists: ["kanban", "tasks"] as const,
  detail: (id: number | null) => ["kanban", "task", id] as const,
};
// ComputedRef<T>는 계산된 값의 반응형 참조 타입이다. 값의 복사본 대신 참조를 받아 URL 변경을 Query key에 반영한다.
export function useKanbanQueries(
  filters: ComputedRef<KanbanFilters>,
  selectedId: ComputedRef<number | null>,
  valid: ComputedRef<boolean>,
) {
  const runtime = useReferenceRuntime();
  const api = createKanbanApi(runtime);
  const authenticated = computed(() => !!runtime.session.identity);
  const access = useQuery({
    queryKey: kanbanKeys.access,
    queryFn: ({ signal }) => api.access(signal),
    enabled: authenticated,
  });
  // access 응답이 명시적으로 allowed=true이고 URL이 유효할 때만 작업 관련 Query를 켠다. 서버 권한 검사를 대체하지 않는다.
  const enabled = computed(
    () => authenticated.value && access.data.value?.allowed === true && valid.value,
  );
  const boards = useQuery({
    queryKey: kanbanKeys.boards,
    queryFn: ({ signal }) => api.boards(signal),
    enabled,
  });
  const users = useQuery({
    queryKey: kanbanKeys.users,
    queryFn: ({ signal }) => api.users(signal),
    enabled,
  });
  // 필터 전체가 queryKey에 들어가므로 조건이 다른 결과를 혼합하지 않는다. queryKey[2]는 이 요청에 대응한 필터다.
  const tasks = useQuery({
    queryKey: computed(() => [...kanbanKeys.lists, filters.value] as const),
    queryFn: ({ queryKey, signal }) => api.tasks(queryKey[2], signal),
    enabled,
  });
  // null ID일 때는 enabled=false다. queryKey[2]!의 !는 TS에게 null이 아니라고 알리는 표기이며 런타임 검사는 아니다.
  const detail = useQuery({
    queryKey: computed(() => kanbanKeys.detail(selectedId.value)),
    queryFn: ({ queryKey, signal }) => api.detail(queryKey[2]!, signal),
    enabled: computed(() => enabled.value && selectedId.value !== null),
  });
  // 멤버 관리 조회는 접근 허용에 더해 현재 역할이 ADMIN일 때만 활성화한다.
  const members = useQuery({
    queryKey: kanbanKeys.members,
    queryFn: ({ signal }) => api.members(signal),
    enabled: computed(() => enabled.value && runtime.session.identity?.role === "ADMIN"),
  });
  return { access, boards, users, tasks, detail, members, enabled };
}
