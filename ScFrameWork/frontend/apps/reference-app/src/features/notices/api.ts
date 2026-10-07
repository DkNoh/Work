import type { FrameworkRuntime } from "@sc/runtime";
import type { components } from "../../generated/api";
import type { ReferenceIdentity } from "../../auth/identity";
export type NoticeResponse = components["schemas"]["NoticeResponse"];

export type NoticeInput = components["schemas"]["NoticeInput"];
export type NoticeUpdateInput = components["schemas"]["NoticeUpdateInput"];
export function createNoticesApi(runtime: FrameworkRuntime<ReferenceIdentity>) {
  const request = runtime.client.request;
  return {
    list: (q: string, signal?: AbortSignal) =>
      request<NoticeResponse[]>(`/kanban/notices?${new URLSearchParams({ q })}`, "GET", undefined, {
        signal,
      }),
    detail: (id: number, signal?: AbortSignal) =>
      request<NoticeResponse>(`/kanban/notices/${id}`, "GET", undefined, { signal }),
    create: (input: NoticeInput) => request<NoticeResponse>("/kanban/notices", "POST", input),
    save: (id: number, input: NoticeUpdateInput) =>
      request<NoticeResponse>(`/kanban/notices/${id}`, "PUT", input),
    remove: (id: number, revision: number) =>
      request<void>(`/kanban/notices/${id}?revision=${revision}`, "DELETE"),
  };
}
