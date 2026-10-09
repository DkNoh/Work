// 예제 목록의 페이지 조회와 등록/수정 요청을 모은다. 화면은 이 함수를 통해 공통 runtime client만 사용한다.
// FrameworkRuntime은 앱 시작 시 생성한 공통 통신 객체다. cookie 세션·CSRF·오류 변환은 그 client가 맡는다.
import type { ApiComponents, FrameworkRuntime } from "@sc/runtime";
import type { ExampleInput } from "./schema";

// DTO 타입을 OpenAPI의 schemas에서 꺼낸다. Java DTO와 비슷한 개발 시 계약이지만 TS 타입은 빌드 후 사라진다.
// request<T>의 T는 Promise 결과의 정적 타입이며, 이것만으로 서버 JSON의 런타임 검증이 수행되지는 않는다.
export type ExampleEntry = ApiComponents["schemas"]["ExampleDto"];
export type ExamplePage = ApiComponents["schemas"]["ExamplePage"];

// 팩토리에 runtime을 주입하고 메서드 묶음을 돌려준다. Java의 생성자 주입과 유사하지만 Spring bean은 아니다.
// signal?: AbortSignal의 ?는 생략 가능 인수다. Query의 취소 신호를 GET에 전달해 불필요한 이전 조회를 중단한다.
export function createExamplesApi(runtime: FrameworkRuntime) {
  return {
    list: (page: number, signal?: AbortSignal) =>
      runtime.client.request<ExamplePage>(`/examples?page=${page}&size=20`, "GET", undefined, {
        signal,
      }),
    create: (input: ExampleInput) =>
      runtime.client.request<ExampleEntry>("/examples", "POST", input),
    // 객체 전개 ...input으로 검증된 입력에 revision을 붙인다. 서버가 최신 버전과 비교해 동시 수정 충돌을 판단한다.
    save: (id: number, input: ExampleInput, revision: number) =>
      runtime.client.request<ExampleEntry>(`/examples/${id}`, "PUT", { ...input, revision }),
  };
}
