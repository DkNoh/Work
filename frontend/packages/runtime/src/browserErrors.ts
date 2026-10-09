/**
 * Vue/브라우저의 미처리 오류를 운영 API로 알리는 선택 기능이다.
 * 오류 원문·stack·현재 URL 대신 앱이 허용한 고정 코드만 전송한다.
 * 사용자/기능 활성 상태의 원본은 소비 앱에 있고, 수집기는 콜백으로 그 순간의 값을 읽는다.
 * type-only import는 App과 client의 타입을 검사할 뿐 Vue 앱이나 HTTP client를 생성하지 않는다.
 */
import type { App } from "vue";
import type { createHttpClient } from "./http";

export type BrowserErrorSource = "VUE" | "WINDOW" | "REJECTION";
export type BrowserErrorEventCode =
  "VUE_ERROR" | "WINDOW_ERROR" | "UNHANDLED_REJECTION" | "UNKNOWN_RUNTIME";
export interface BrowserErrorEvent {
  readonly schemaVersion: 1;
  readonly clientEventId: string;
  readonly source: BrowserErrorSource;
  readonly eventCode: BrowserErrorEventCode;
  readonly appVersion: string;
  readonly routeCode: string;
  readonly componentCode: "ROOT";
}
export interface BrowserErrorCollectorOptions {
  readonly app: App;
  // ReturnType은 함수 반환 타입, Pick은 그중 필요한 두 메서드만 선택하는 TypeScript 도구다.
  // 수집기는 로그인/로그아웃이나 임의의 세션 변경 기능까지 의존하지 않는다.
  readonly client: Pick<ReturnType<typeof createHttpClient>, "request" | "getGeneration">;
  readonly enabled: () => boolean;
  readonly authenticated: () => boolean;
  readonly routeCode: () => string | undefined;
  readonly allowedRoutes: readonly string[];
  /** 앱 release의 고정 SemVer다. 입력·URL에서 읽지 않는다. 최대 64자, 기본 0.1.0. */
  readonly appVersion?: string;
}

/** 원문을 읽거나 저장하지 않고 등록한 코드만 수집한다. 실패한 전송은 재시도하지 않는다. */
export function createBrowserErrorCollector(options: BrowserErrorCollectorOptions) {
  // 릴리스 버전도 전송 필드이므로 등록된 SemVer 형식과 길이를 먼저 검사한다.
  // 사용자 입력을 버전으로 받아 보내지 않으며 숫자 prerelease의 앞자리 0도 허용하지 않는다.
  const appVersion = options.appVersion ?? "0.1.0";
  const version =
    typeof appVersion === "string" && appVersion.length <= 64 && appVersion === appVersion.trim()
      ? /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
          appVersion,
        )
      : null;
  if (
    !version ||
    version[4]
      ?.split(".")
      .some(
        (identifier) =>
          /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith("0"),
      )
  )
    throw new TypeError("등록된 앱 release version을 확인하세요.");
  let disposed = false;
  let generation = options.client.getGeneration();
  // WeakSet은 같은 Error 객체의 중복/전송 오류를 구분한다. 오류를 문자열로 직렬화하지 않고,
  // 다른 참조가 사라진 객체의 메모리 회수를 Set처럼 붙잡아 두지도 않는다.
  let seenErrors = new WeakSet<object>();
  let transportErrors = new WeakSet<object>();
  // URL·query 문자열을 이름 목록에 잘못 넣어도 코드로 전송하지 않는다.
  const routes = new Set(
    options.allowedRoutes.filter((route) => /^[a-z][a-z0-9-]{0,63}$/.test(route)),
  );
  const queue: { generation: number; event: BrowserErrorEvent }[] = [];
  let scheduled = false;
  let sending = false;
  let activeRequest: AbortController | null = null;
  const previousHandler = options.app.config.errorHandler;

  // HTTP client의 세션 세대가 바뀌면 대기 이벤트와 중복 판별도 새로 시작한다.
  // 로그인 A의 오류가 로그인 B의 운영 기록으로 전송되는 것을 방지한다.
  function currentSession() {
    const current = options.client.getGeneration();
    if (current !== generation) {
      generation = current;
      queue.length = 0;
      seenErrors = new WeakSet();
      transportErrors = new WeakSet();
    }
    return current;
  }

  // 큐를 한 건씩 순서대로 보낸다. sending이 겹친 drain을 막으며 각 POST의 AbortController는
  // dispose에서 취소할 수 있다. 전송 실패는 재시도/재수집하지 않아 오류 폭주를 확대하지 않는다.
  async function sendQueued() {
    scheduled = false;
    if (sending || disposed) return;
    sending = true;
    try {
      while (!disposed && queue.length) {
        const epoch = currentSession();
        const next = queue.shift();
        // 대기 중 로그아웃/기능 OFF가 될 수 있으므로 capture 때와 전송 직전 모두 검사한다.
        if (!next || next.generation !== epoch || !options.enabled() || !options.authenticated())
          continue;
        const controller = new AbortController();
        activeRequest = controller;
        try {
          await options.client.request("/operations/browser-errors", "POST", next.event, {
            signal: controller.signal,
          });
        } catch (cause) {
          // 수집 요청 실패가 다시 Vue/window hook에 전달돼도 재수집하지 않는다.
          if (typeof cause === "object" && cause !== null) transportErrors.add(cause);
        } finally {
          if (activeRequest === controller) activeRequest = null;
        }
      }
    } catch {
      // 소비 앱의 상태 callback 실패도 새 오류 전송/console 기록으로 확대하지 않는다.
      queue.length = 0;
    } finally {
      sending = false;
    }
  }

  // 전역 훅에서 호출되는 동기 진입점이다. 최대 20개 대기 제한을 적용한 뒤 안전한 코드만 큐에 넣는다.
  // 이것은 Vue watch가 아니다. 오류 이벤트 때 콜백으로 최신 상태를 읽는 명령형 이벤트 처리다.
  function capture(source: BrowserErrorSource, cause: unknown) {
    try {
      const epoch = currentSession();
      if (disposed || !options.enabled() || !options.authenticated()) return;
      const routeCode = options.routeCode();
      if (!routeCode || !routes.has(routeCode) || queue.length >= 20) return;
      if (typeof cause === "object" && cause !== null && transportErrors.has(cause)) return;
      // message/stack/info/component/url을 열람하지 않고 Error의 동일 객체만 구분한다.
      if (cause instanceof Error) {
        if (seenErrors.has(cause)) return;
        seenErrors.add(cause);
      }
      const eventCode: BrowserErrorEventCode = !(cause instanceof Error)
        ? "UNKNOWN_RUNTIME"
        : source === "VUE"
          ? "VUE_ERROR"
          : source === "WINDOW"
            ? "WINDOW_ERROR"
            : "UNHANDLED_REJECTION";
      queue.push({
        generation: epoch,
        event: {
          schemaVersion: 1,
          clientEventId: crypto.randomUUID(),
          source,
          eventCode,
          appVersion,
          routeCode,
          componentCode: "ROOT",
        },
      });
      if (!scheduled && !sending) {
        // microtask에서 전송을 시작해 현재 오류 훅의 실행을 먼저 마친다.
        // void는 Promise를 기다리지 않는다는 표시이며 실패 처리는 sendQueued 내부가 책임진다.
        scheduled = true;
        void Promise.resolve().then(sendQueued);
      }
    } catch {
      // UUID/상태 판독이 불가능하면 수집만 포기하고 앱 오류 처리 계약을 유지한다.
    }
  }

  // 기존 Vue 핸들러를 연결해 앱 자체의 오류 처리 흐름을 보존한다.
  // NonNullable은 설정에서 선택 항목인 errorHandler의 undefined/null만 타입에서 제외한다.
  const vueHandler: NonNullable<App["config"]["errorHandler"]> = (cause, instance, info) => {
    capture("VUE", cause);
    previousHandler?.(cause, instance, info);
  };
  const windowHandler = (event: ErrorEvent) => capture("WINDOW", event.error);
  const rejectionHandler = (event: PromiseRejectionEvent) => capture("REJECTION", event.reason);
  options.app.config.errorHandler = vueHandler;
  if (typeof window !== "undefined") {
    window.addEventListener("error", windowHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);
  }

  function dispose() {
    // 전역 listener를 등록했으므로 반드시 같은 함수 참조로 해제한다. 중복 호출은 무시하고,
    // 다른 코드가 새 errorHandler를 설치했다면 그 핸들러를 이전 것으로 덮어쓰지 않는다.
    if (disposed) return;
    disposed = true;
    queue.length = 0;
    activeRequest?.abort();
    activeRequest = null;
    if (options.app.config.errorHandler === vueHandler)
      options.app.config.errorHandler = previousHandler;
    if (typeof window !== "undefined") {
      window.removeEventListener("error", windowHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    }
  }
  // 컴포넌트 하나가 아니라 앱 전체 unmount에 연결한다. 수동 중지에도 같은 dispose를 제공한다.
  options.app.onUnmount(dispose);
  return { dispose };
}
