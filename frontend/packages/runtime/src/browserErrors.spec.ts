import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "vue";
import { createHttpClient } from "./http";
import { createBrowserErrorCollector, type BrowserErrorEvent } from "./browserErrors";

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

function testApp(fail?: () => void) {
  return createApp({
    methods: { fail: () => fail?.() },
    template: fail ? "<button @click='fail'>Invoke</button>" : "<div />",
  });
}

function fixture(
  app = testApp(),
  allowedRoutes = ["examples", "operations-browser-errors"],
  appVersion?: string,
) {
  let enabled = true;
  let authenticated = true;
  let route = "examples";
  const sent: BrowserErrorEvent[] = [];
  const client = createHttpClient({
    adapter: async (config) => {
      if (config.url === "/operations/browser-errors") sent.push(JSON.parse(config.data));
      return {
        config,
        data:
          config.url === "/auth/csrf"
            ? { headerName: "X-CSRF-TOKEN", token: "synthetic" }
            : { accepted: true },
        headers: {},
        status: config.url === "/auth/csrf" ? 200 : 202,
        statusText: "OK",
      };
    },
  });
  const previous = vi.fn();
  app.config.errorHandler = previous;
  const collector = createBrowserErrorCollector({
    app,
    client,
    enabled: () => enabled,
    authenticated: () => authenticated,
    routeCode: () => route,
    allowedRoutes,
    appVersion,
  });
  disposers.push(collector.dispose, client.dispose);
  return {
    app,
    client,
    collector,
    sent,
    previous,
    setEnabled: (value: boolean) => (enabled = value),
    setAuthenticated: (value: boolean) => (authenticated = value),
    setRoute: (value: string) => (route = value),
  };
}

function windowError(error: Error) {
  window.dispatchEvent(new ErrorEvent("error", { error }));
}
function rejection(reason: unknown) {
  const event = new Event("unhandledrejection");
  Object.defineProperty(event, "reason", { value: reason });
  window.dispatchEvent(event);
}

describe("브라우저 오류 수집의 실제 hook 계약", () => {
  it("Vue/window/rejection은 원문 property를 읽지 않고 동일 Error를 한 번만 전송한다", async () => {
    const f = fixture();
    const cause = new Error();
    const read = vi.fn(() => {
      throw new Error("Raw property must not be inspected");
    });
    Object.defineProperties(cause, {
      stack: { get: read },
      message: { get: read },
    });
    f.app.config.errorHandler?.(cause, null, "opaque Vue info");
    windowError(cause);
    rejection(cause);
    await vi.waitFor(() => expect(f.sent).toHaveLength(1));
    expect(read).not.toHaveBeenCalled();
    expect(f.previous.mock.calls[0]?.[0]).toBe(cause);
    expect(f.previous.mock.calls[0]?.slice(1)).toEqual([null, "opaque Vue info"]);
    expect(f.sent[0]).toEqual({
      schemaVersion: 1,
      clientEventId: expect.stringMatching(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i),
      source: "VUE",
      eventCode: "VUE_ERROR",
      appVersion: "0.1.0",
      routeCode: "examples",
      componentCode: "ROOT",
    });
    windowError(new Error("window canary"));
    rejection(new Error("rejection canary"));
    await vi.waitFor(() => expect(f.sent).toHaveLength(3));
    expect(f.sent.slice(1).map((item) => [item.source, item.eventCode])).toEqual([
      ["WINDOW", "WINDOW_ERROR"],
      ["REJECTION", "UNHANDLED_REJECTION"],
    ]);
    expect(JSON.stringify(f.sent)).not.toMatch(/canary|opaque|message|stack|info/);
  });

  it("로그인 전·기능OFF·미등록 Router name에서는 전송하지 않는다", async () => {
    const f = fixture();
    f.setAuthenticated(false);
    windowError(new Error());
    f.setAuthenticated(true);
    f.setEnabled(false);
    rejection(new Error());
    f.setEnabled(true);
    f.setRoute("/examples?token=canary");
    f.app.config.errorHandler?.(new Error(), null, "opaque");
    await Promise.resolve();
    expect(f.sent).toHaveLength(0);
    f.setRoute("operations-browser-errors");
    rejection("private rejection body");
    await vi.waitFor(() => expect(f.sent).toHaveLength(1));
    expect(f.sent[0]?.eventCode).toBe("UNKNOWN_RUNTIME");
    expect(JSON.stringify(f.sent)).not.toContain("private");
  });

  it("실제 Vue template DOM 이벤트의 예외는 기존 Vue handler와 수집기를 함께 거친다", async () => {
    const cause = new Error("private Vue canary");
    const app = testApp(() => {
      throw cause;
    });
    const f = fixture(app);
    const element = document.createElement("div");
    document.body.append(element);
    app.mount(element);
    element.querySelector("button")?.click();
    await vi.waitFor(() => expect(f.sent).toHaveLength(1));
    expect(f.previous.mock.calls[0]?.[0]).toBe(cause);
    expect(f.sent[0]?.source).toBe("VUE");
    expect(f.sent[0]?.eventCode).toBe("VUE_ERROR");
    expect(JSON.stringify(f.sent)).not.toMatch(/private|canary|message|stack/);
    app.unmount();
    element.remove();
  });

  it("microtask 전 세션generation 변경은 이전 큐를 폐기하고 새 세션 Error를 수집한다", async () => {
    const f = fixture();
    const cause = new Error();
    windowError(cause);
    f.client.resetSession();
    await Promise.resolve();
    expect(f.sent).toHaveLength(0);
    windowError(cause);
    await vi.waitFor(() => expect(f.sent).toHaveLength(1));
  });
  it("allowedRoutes에도 URL을 잘못 등록한 경우 경로·query를 전송하지 않는다", async () => {
    const f = fixture(testApp(), ["/examples?token=private"]);
    f.setRoute("/examples?token=private");
    windowError(new Error());
    await Promise.resolve();
    expect(f.sent).toHaveLength(0);
  });
  it("소비 앱의 고정 release version을 전송하고 잘못된 값은 hook을 설치하기 전에 거절한다", async () => {
    const f = fixture(testApp(), ["examples"], "1.0.0");
    windowError(new Error());
    await vi.waitFor(() => expect(f.sent).toHaveLength(1));
    expect(f.sent[0]?.appVersion).toBe("1.0.0");
    f.collector.dispose();
    for (const appVersion of [
      "01.0.0",
      "1.0.0-01",
      "1.0.0\n",
      "secret?token=value",
      "1.0.0+" + "a".repeat(64),
    ]) {
      const app = testApp();
      const previous = vi.fn();
      app.config.errorHandler = previous;
      const client = createHttpClient();
      try {
        expect(() =>
          createBrowserErrorCollector({
            app,
            client,
            appVersion,
            allowedRoutes: ["examples"],
            routeCode: () => "examples",
            authenticated: () => true,
            enabled: () => true,
          }),
        ).toThrow(TypeError);
        expect(app.config.errorHandler).toBe(previous);
      } finally {
        client.dispose();
      }
    }
  });

  it("수집 전송 실패는 재시도·재수집·새 console 기록으로 확대하지 않는다", async () => {
    const app = testApp();
    const transportError = new Error("transport private canary");
    const request = vi.fn(async () => {
      throw transportError;
    });
    const consoleError = vi.spyOn(console, "error");
    const collector = createBrowserErrorCollector({
      app,
      client: { request, getGeneration: () => 1 },
      enabled: () => true,
      authenticated: () => true,
      routeCode: () => "examples",
      allowedRoutes: ["examples"],
    });
    disposers.push(collector.dispose);
    windowError(new Error());
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    app.config.errorHandler?.(transportError, null, "opaque");
    rejection(transportError);
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("dispose는 hook과 큐를 해제하고 다른 소유자가 바꾼 Vue handler를 덮지 않는다", async () => {
    const f = fixture();
    windowError(new Error());
    f.collector.dispose();
    expect(f.app.config.errorHandler).toBe(f.previous);
    windowError(new Error());
    rejection(new Error());
    await Promise.resolve();
    expect(f.sent).toHaveLength(0);

    const g = fixture();
    const replacement = vi.fn();
    g.app.config.errorHandler = replacement;
    g.collector.dispose();
    expect(g.app.config.errorHandler).toBe(replacement);
  });
});
