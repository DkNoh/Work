import { computed, type ComputedRef } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useReferenceRuntime } from "../../auth/identity";
import { createKanbanApi, type KanbanFilters } from "./api";
export const kanbanKeys = {
  all: ["kanban"] as const,
  access: ["kanban", "access"] as const,
  boards: ["kanban", "boards"] as const,
  users: ["kanban", "users"] as const,
  members: ["kanban", "members"] as const,
  lists: ["kanban", "tasks"] as const,
  detail: (id: number | null) => ["kanban", "task", id] as const,
};
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
  const tasks = useQuery({
    queryKey: computed(() => [...kanbanKeys.lists, filters.value] as const),
    queryFn: ({ queryKey, signal }) => api.tasks(queryKey[2], signal),
    enabled,
  });
  const detail = useQuery({
    queryKey: computed(() => kanbanKeys.detail(selectedId.value)),
    queryFn: ({ queryKey, signal }) => api.detail(queryKey[2]!, signal),
    enabled: computed(() => enabled.value && selectedId.value !== null),
  });
  const members = useQuery({
    queryKey: kanbanKeys.members,
    queryFn: ({ signal }) => api.members(signal),
    enabled: computed(() => enabled.value && runtime.session.identity?.role === "ADMIN"),
  });
  return { access, boards, users, tasks, detail, members, enabled };
}
