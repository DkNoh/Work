// 요구사항 화면이 호출하는 HTTP 어댑터다. 목록/상세 조회와 본문·담당자·검토·상태 변경 명령을 묶는다.
// FrameworkRuntime은 앱 시작 시 생성한 공통 통신 객체다. cookie 세션·CSRF·오류 변환은 그 client가 맡는다.
import type { FrameworkRuntime } from "@sc/runtime";
import type { components } from "../../generated/api";
import type { ReferenceIdentity } from "../../auth/identity";

// DTO 타입을 OpenAPI의 schemas에서 꺼낸다. Java DTO와 비슷한 개발 시 계약이지만 TS 타입은 빌드 후 사라진다.
// request<T>의 T는 Promise 결과의 정적 타입이며, 이것만으로 서버 JSON의 런타임 검증이 수행되지는 않는다.
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

// 팩토리에 runtime을 주입하고 메서드 묶음을 돌려준다. Java의 생성자 주입과 유사하지만 Spring bean은 아니다.
// signal?: AbortSignal의 ?는 생략 가능 인수다. Query의 취소 신호를 GET에 전달해 불필요한 이전 조회를 중단한다.
export function createRequirementsApi(runtime: FrameworkRuntime<ReferenceIdentity>) {
  const request = runtime.client.request;
  // 수정 명령의 응답은 최신 상세 DTO다. 트랜잭션·revision 검사·상태 전이는 서버 Service의 책임이다.
  const command = (id: number, path: string, method: string, data: unknown) =>
    request<RequirementDetail>(`/requirements/${id}${path}`, method, data);
  return {
    users: (signal?: AbortSignal) => request<User[]>("/users", "GET", undefined, { signal }),
    menus: (signal?: AbortSignal) => request<Menu[]>("/menus", "GET", undefined, { signal }),
    // URLSearchParams로 조건을 인코딩한다. 화면의 Router 조건을 HTTP query string으로 옮기는 경계다.
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
    // 아래 revision 명령은 편집 기준 버전을 전송한다. 충돌은 서버 409 → ApiError → 화면의 입력 보존 경로로 돌아온다.
    submit: (id: number, revision: number) => command(id, "/submit", "POST", { revision }),
    assign: (id: number, revision: number, reviewerId: number | null) =>
      command(id, "/assignee", "PUT", { revision, reviewerId }),
    review: (id: number, input: ReviewInput) => command(id, "/review", "PUT", input),
    agree: (id: number, revision: number) => command(id, "/agree", "POST", { revision }),
    // 댓글 추가는 이 API 계약에서 revision을 받지 않는다. 본문/검토 저장과 같은 인수로 일반화하지 않는다.
    comment: (id: number, body: string) => command(id, "/comments", "POST", { body }),
  };
}
