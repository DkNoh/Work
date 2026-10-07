import type { FrameworkRuntime } from "@sc/runtime";
import type { ReferenceIdentity } from "../../auth/identity";
import type { components } from "../../generated/api";
export type User = components["schemas"]["UserResponse"];
export type Menu = components["schemas"]["MenuResponse"];
export type AuditPage = components["schemas"]["AuditPage"];
export const adminKeys = {
  users: ["requirement-users"] as const,
  menus: ["requirement-menus"] as const,
  audit: ["audit-events"] as const,
};
export function createAdminApi(runtime: FrameworkRuntime<ReferenceIdentity>) {
  const request = runtime.client.request;
  return {
    users: (signal?: AbortSignal) => request<User[]>("/users", "GET", undefined, { signal }),
    createUser: (input: components["schemas"]["NewUserInput"]) =>
      request<User>("/users", "POST", input),
    menus: (signal?: AbortSignal) => request<Menu[]>("/menus", "GET", undefined, { signal }),
    createMenu: (input: components["schemas"]["MenuInput"]) =>
      request<Menu>("/menus", "POST", input),
    saveMenu: (id: number, input: components["schemas"]["MenuEditInput"]) =>
      request<Menu>(`/menus/${id}`, "PUT", input),
    audit: (query: URLSearchParams, signal?: AbortSignal) =>
      request<AuditPage>(`/audit/events?${query}`, "GET", undefined, { signal }),
  };
}
