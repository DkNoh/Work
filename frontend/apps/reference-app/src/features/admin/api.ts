// 관리 화면의 사용자·메뉴·감사 조회 및 변경 요청을 모은다. ADMIN 여부는 화면 표시와 별개로 서버가 다시 검사한다.
// FrameworkRuntime은 앱 시작 시 생성한 공통 통신 객체다. cookie 세션·CSRF·오류 변환은 그 client가 맡는다.
import type { FrameworkRuntime } from "@sc/runtime";
import type { ReferenceIdentity } from "../../auth/identity";
import type { components } from "../../generated/api";
// DTO 타입을 OpenAPI의 schemas에서 꺼낸다. Java DTO와 비슷한 개발 시 계약이지만 TS 타입은 빌드 후 사라진다.
// request<T>의 T는 Promise 결과의 정적 타입이며, 이것만으로 서버 JSON의 런타임 검증이 수행되지는 않는다.
export type User = components["schemas"]["UserResponse"];
export type Menu = components["schemas"]["MenuResponse"];
export type AuditPage = components["schemas"]["AuditPage"];
// 요구사항 lookup과 같은 users/menus 키를 공유한다. 관리자 변경 후 무효화하면 선택 옵션을 사용하는 화면도 갱신된다.
export const adminKeys = {
  users: ["requirement-users"] as const,
  menus: ["requirement-menus"] as const,
  audit: ["audit-events"] as const,
};
// 팩토리에 runtime을 주입하고 메서드 묶음을 돌려준다. Java의 생성자 주입과 유사하지만 Spring bean은 아니다.
// signal?: AbortSignal의 ?는 생략 가능 인수다. Query의 취소 신호를 GET에 전달해 불필요한 이전 조회를 중단한다.
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
