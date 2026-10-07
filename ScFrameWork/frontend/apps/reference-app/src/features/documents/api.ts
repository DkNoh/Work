import type { FrameworkRuntime } from "@sc/runtime";
import type { components } from "../../generated/api";
import type { ReferenceIdentity } from "../../auth/identity";
export type DocumentResponse = components["schemas"]["DocumentResponse"];
export type DocumentSummary = components["schemas"]["DocumentSummary"];
export type DocumentInput = components["schemas"]["DocumentInput"];
export type DocumentUpdateInput = components["schemas"]["DocumentUpdateInput"];
export function createDocumentsApi(runtime: FrameworkRuntime<ReferenceIdentity>) {
  const request = runtime.client.request;
  return {
    list: (signal?: AbortSignal) =>
      request<DocumentSummary[]>(`/documents`, "GET", undefined, { signal }),
    detail: (id: number, signal?: AbortSignal) =>
      request<DocumentResponse>(`/documents/${id}`, "GET", undefined, { signal }),
    create: (input: DocumentInput) => request<DocumentResponse>("/documents", "POST", input),
    save: (id: number, input: DocumentUpdateInput) =>
      request<DocumentResponse>(`/documents/${id}`, "PUT", input),
    remove: (id: number, revision: number) =>
      request<void>(`/documents/${id}?revision=${revision}`, "DELETE"),
  };
}
