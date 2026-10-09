/**
 * @sc/runtime의 공개 진입점이다. 소비 앱은 내부 파일 경로 대신 여기서 필요한 기능을 가져온다.
 * Java의 패키지 공개 API처럼 외부에 제공할 이름을 모으지만, 이 파일 자체는 앱을 생성하지 않는다.
 * `export type`은 TypeScript 검사에만 쓰이고 실행 JavaScript에서 사라진다.
 * 함수·클래스 export와 DTO 모양을 나타내는 type export를 구분해 읽으면 된다.
 */
export { ApiError, createHttpClient, type RequestOptions, type HttpClientOptions } from "./http";
/** 001~006 중립 예제의 호환 타입. 신규 업무 계약은 각 소비 앱의 generated/api에서 가져온다. */
export type { components as ApiComponents } from "./generated/api";
export {
  createBrowserErrorCollector,
  type BrowserErrorCollectorOptions,
  type BrowserErrorEvent,
  type BrowserErrorEventCode,
  type BrowserErrorSource,
} from "./browserErrors";
export {
  createFrameworkRuntime,
  useFrameworkRuntime,
  type FrameworkRuntime,
  type FrameworkRuntimeOptions,
  type Identity,
} from "./runtime";
