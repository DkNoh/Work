import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useReferenceRuntime } from "../../auth/identity";
import { createRequirementsApi } from "./api";

export const requirementKeys = {
  all: ["requirements"] as const,
  lists: ["requirements", "list"] as const,
  detail: (id: number | null) => ["requirements", "detail", id] as const,
  users: ["requirement-users"] as const,
  menus: ["requirement-menus"] as const,
};
export function useRequirementLookups() {
  const runtime = useReferenceRuntime();
  const api = createRequirementsApi(runtime);
  const enabled = computed(() => !!runtime.session.identity);
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
