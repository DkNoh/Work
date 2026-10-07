import type { FrameworkRuntime } from "@sc/runtime";
import type { ReferenceIdentity } from "../../auth/identity";
import type { components } from "../../generated/api";
import type { RequirementDetail } from "../requirements/api";
export type Screen = components["schemas"]["ScreenResponse"];
export type ScreenVersion = components["schemas"]["RequirementScreenVersionResponse"];
export type VersionAnnotation = components["schemas"]["VersionAnnotationResponse"];
export const mediaKeys = {
  all: ["media"] as const,
  screens: ["media", "screens"] as const,
  versions: (id: number | null) => ["media", "versions", id] as const,
  annotations: (id: number | null) => ["media", "annotations", id] as const,
  file: (id: number | null) => ["media-file", id] as const,
};
export function createMediaApi(runtime: FrameworkRuntime<ReferenceIdentity>) {
  const request = runtime.client.request;
  return {
    screens: (signal?: AbortSignal) => request<Screen[]>("/screens", "GET", undefined, { signal }),
    createScreen: (input: components["schemas"]["ScreenInput"]) =>
      request<Screen>("/screens", "POST", input),
    versions: (id: number, signal?: AbortSignal) =>
      request<ScreenVersion[]>(`/screens/${id}/versions`, "GET", undefined, { signal }),
    uploadVersion: (id: number, file: File) => {
      const data = new FormData();
      data.append("file", file);
      return request<ScreenVersion>(`/screens/${id}/versions`, "POST", data);
    },
    archive: (id: number) => request<ScreenVersion>(`/versions/${id}/archive`, "POST"),
    annotations: (id: number, signal?: AbortSignal) =>
      request<VersionAnnotation[]>(`/versions/${id}/annotations`, "GET", undefined, { signal }),
    file: (id: number, signal?: AbortSignal) =>
      request<Blob>(`/files/${id}`, "GET", undefined, { signal, responseType: "blob" }),
    annotation: (id: number, input: components["schemas"]["AnnotationInput"]) =>
      request<RequirementDetail>(`/requirements/${id}/annotation`, "PUT", input),
    deleteAnnotation: (id: number, revision: number) =>
      request<RequirementDetail>(`/requirements/${id}/annotation?revision=${revision}`, "DELETE"),
    attach: (id: number, revision: number, file: File) => {
      const data = new FormData();
      data.append("file", file);
      data.append("revision", String(revision));
      return request<RequirementDetail>(`/requirements/${id}/attachments`, "POST", data);
    },
    deleteAttachment: (id: number, attachmentId: number, revision: number) =>
      request<RequirementDetail>(
        `/requirements/${id}/attachments/${attachmentId}?revision=${revision}`,
        "DELETE",
      ),
    ado: (id: number, input: components["schemas"]["AdoInput"]) =>
      request<RequirementDetail>(`/requirements/${id}/ado`, "PUT", input),
    exportText: (id: number) =>
      request<components["schemas"]["RequirementExport"]>(`/requirements/${id}/export`),
  };
}
