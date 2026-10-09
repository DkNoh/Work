// 개인 문서의 목록/상세와 저장 API다. 목록은 요약 DTO, 상세는 documentJson을 포함한 DTO를 사용한다.
// FrameworkRuntime은 앱 시작 시 생성한 공통 통신 객체다. cookie 세션·CSRF·오류 변환은 그 client가 맡는다.
import type { FrameworkRuntime } from "@sc/runtime";
import type { components } from "../../generated/api";
import type { ReferenceIdentity } from "../../auth/identity";
// DTO 타입을 OpenAPI의 schemas에서 꺼낸다. Java DTO와 비슷한 개발 시 계약이지만 TS 타입은 빌드 후 사라진다.
// request<T>의 T는 Promise 결과의 정적 타입이며, 이것만으로 서버 JSON의 런타임 검증이 수행되지는 않는다.
export type DocumentResponse = components["schemas"]["DocumentResponse"];
export type DocumentSummary = components["schemas"]["DocumentSummary"];
export type DocumentInput = components["schemas"]["DocumentInput"];
export type DocumentUpdateInput = components["schemas"]["DocumentUpdateInput"];
// 팩토리에 runtime을 주입하고 메서드 묶음을 돌려준다. Java의 생성자 주입과 유사하지만 Spring bean은 아니다.
// signal?: AbortSignal의 ?는 생략 가능 인수다. Query의 취소 신호를 GET에 전달해 불필요한 이전 조회를 중단한다.
export function createDocumentsApi(runtime: FrameworkRuntime<ReferenceIdentity>) {
  const request = runtime.client.request;
  return {
    list: (signal?: AbortSignal) =>
      request<DocumentSummary[]>(`/documents`, "GET", undefined, { signal }),
    detail: (id: number, signal?: AbortSignal) =>
      request<DocumentResponse>(`/documents/${id}`, "GET", undefined, { signal }),
    create: (input: DocumentInput) => request<DocumentResponse>("/documents", "POST", input),
    // 수정 입력에는 편집 시작 revision이 들어간다. 삭제도 같은 버전을 보내며, 실패 시 폼을 비우지 않는 것은 부모 화면의 책임이다.
    save: (id: number, input: DocumentUpdateInput) =>
      request<DocumentResponse>(`/documents/${id}`, "PUT", input),
    remove: (id: number, revision: number) =>
      request<void>(`/documents/${id}?revision=${revision}`, "DELETE"),
  };
}
