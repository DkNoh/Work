import type { FrameworkRuntime } from "@sc/runtime";
import type { components } from "../../generated/api";
import type { ReferenceIdentity } from "../../auth/identity";

export type RequirementSummary = components["schemas"]["RequirementSummary"];
export type RequirementDetail = components["schemas"]["RequirementDetail"];
export type RequirementPage = components["schemas"]["RequirementPage"];
export type RequirementInput = components["schemas"]["RequirementInput"];
export type ReviewInput = components["schemas"]["ReviewInput"];
export type User = components["schemas"]["UserResponse"];
export type Menu = components["schemas"]["MenuResponse"];
export interface RequirementFilters {
  q: string;
  menuId: number | null;
  status: string;
  authorId: number | null;
  page: number;
  size: number;
}

export function createRequirementsApi(runtime: FrameworkRuntime<ReferenceIdentity>) {
  const request = runtime.client.request;
  const command = (id: number, path: string, method: string, data: unknown) =>
    request<RequirementDetail>(`/requirements/${id}${path}`, method, data);
  return {
    users: (signal?: AbortSignal) => request<User[]>("/users", "GET", undefined, { signal }),
    menus: (signal?: AbortSignal) => request<Menu[]>("/menus", "GET", undefined, { signal }),
    list(filters: RequirementFilters, signal?: AbortSignal) {
      const query = new URLSearchParams({ page: String(filters.page), size: String(filters.size) });
      if (filters.q) query.set("q", filters.q);
      if (filters.menuId) query.set("menuId", String(filters.menuId));
      if (filters.status) query.set("status", filters.status);
      if (filters.authorId) query.set("authorId", String(filters.authorId));
      return request<RequirementPage>(`/requirements?${query}`, "GET", undefined, { signal });
    },
    detail: (id: number, signal?: AbortSignal) =>
      request<RequirementDetail>(`/requirements/${id}`, "GET", undefined, { signal }),
    create: (input: RequirementInput) => request<RequirementDetail>("/requirements", "POST", input),
    save: (id: number, input: RequirementInput) => command(id, "", "PUT", input),
    submit: (id: number, revision: number) => command(id, "/submit", "POST", { revision }),
    assign: (id: number, revision: number, reviewerId: number | null) =>
      command(id, "/assignee", "PUT", { revision, reviewerId }),
    review: (id: number, input: ReviewInput) => command(id, "/review", "PUT", input),
    agree: (id: number, revision: number) => command(id, "/agree", "POST", { revision }),
    comment: (id: number, body: string) => command(id, "/comments", "POST", { body }),
  };
}
