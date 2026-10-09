/**
 * 이미지 작업실/첨부/주석 기능의 HTTP 경계. 실제 서버 DTO 타입은 OpenAPI 생성 components에서 선택하여 재사용한다.
 * components["schemas"][...]는 맵의 키로 타입을 꺼내는 indexed access다. 런타임 객체 조회가 아니라 컴파일 시 타입 선언이다.
 * factory에 앱 runtime을 전달하는 방식은 Service 생성자 의존성 주입과 비슷하다. 모든 요청은 이 runtime.client 하나를 경유한다.
 * mediaKeys의 as const는 Query 키 tuple을 읽기 전용 리터럴로 고정한다. 이 키가 목록/버전/파일 캐시의 갱신 범위를 결정한다.
 */
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
/**
 * 파일 업로드는 FormData, 다운로드는 responseType blob으로 구분한다. 세션 쿠키/CSRF/timeout/오류 변환은 공통 client가 담당한다.
 * 수정/삭제의 revision은 다른 사용자의 변경을 덮지 않기 위한 업무 동시성 값이며 API 규칙은 서버 Service가 최종 검증한다.
 */
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
