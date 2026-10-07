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

  async function sendQueued() {
    scheduled = false;
    if (sending || disposed) return;
    sending = true;
    try {
      while (!disposed && queue.length) {
        const epoch = currentSession();
        const next = queue.shift();
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
        scheduled = true;
        void Promise.resolve().then(sendQueued);
      }
    } catch {
      // UUID/상태 판독이 불가능하면 수집만 포기하고 앱 오류 처리 계약을 유지한다.
    }
  }

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
  options.app.onUnmount(dispose);
  return { dispose };
}
