import { describe, expect, it } from "vitest";
import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { createMemoryHistory } from "vue-router";
import { createHttpClient } from "./http";
import { createFrameworkRuntime } from "./runtime";

function response(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
): AxiosResponse {
  return { config, status, data, statusText: String(status), headers: {} };
}

describe("공통 HTTP와 세션 경계", () => {
  it("세션 전환 후 도착한 이전 응답을 폐기한다", async () => {
    let complete: (() => void) | undefined;
    const adapter: AxiosAdapter = (config) =>
      new Promise((resolve) => {
        complete = () => resolve(response(config, 200, { title: "이전 세션" }));
      });
    const client = createHttpClient({ adapter });
    const pending = client.request("/examples");
    const rejected = expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    client.resetSession();
    complete?.();
    await rejected;
    client.dispose();
  });

  it("서버 필드 오류를 ApiError.fields에 연결한다", async () => {
    const adapter: AxiosAdapter = async (config) =>
      response(config, 400, {
        code: "VALIDATION",
        message: "입력을 확인해 주세요.",
        errors: [{ field: "title", message: "제목 오류" }],
      });
    const client = createHttpClient({ adapter });
    await expect(client.request("/examples")).rejects.toMatchObject({
      status: 400,
      fields: { title: "제목 오류" },
    });
    client.dispose();
  });

  it("동시 저장은 CSRF 발급 한 번을 공유하고 토큰 헤더를 전달한다", async () => {
    let tokenCalls = 0;
    const headers: unknown[] = [];
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === "/auth/csrf") {
        tokenCalls += 1;
        return response(config, 200, { headerName: "X-CSRF-TOKEN", token: "synthetic-token" });
      }
      headers.push(config.headers.get("X-CSRF-TOKEN"));
      return response(config, 201, { id: 1 });
    };
    const client = createHttpClient({ adapter });
    await Promise.all([
      client.request("/examples", "POST", { title: "첫 예제" }),
      client.request("/examples", "POST", { title: "둘째 예제" }),
    ]);
    expect(tokenCalls).toBe(1);
    expect(headers).toEqual(["synthetic-token", "synthetic-token"]);
    client.dispose();
  });

  it("CSRF 403은 자동 저장 재시도 없이 다음 제출에서 새 토큰을 발급한다", async () => {
    let tokenCalls = 0;
    let writes = 0;
    const headers: unknown[] = [];
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === "/auth/csrf") {
        tokenCalls += 1;
        return response(config, 200, {
          headerName: "X-CSRF-TOKEN",
          token: `synthetic-${tokenCalls}`,
        });
      }
      writes += 1;
      headers.push(config.headers.get("X-CSRF-TOKEN"));
      return writes === 1
        ? response(config, 403, { code: "CSRF", message: "보안 토큰 오류" })
        : response(config, 201, { id: 1 });
    };
    const client = createHttpClient({ adapter });
    await expect(client.request("/examples", "POST", { title: "입력 유지" })).rejects.toMatchObject(
      { code: "CSRF" },
    );
    expect(writes).toBe(1);
    await client.request("/examples", "POST", { title: "입력 유지" });
    expect(tokenCalls).toBe(2);
    expect(headers).toEqual(["synthetic-1", "synthetic-2"]);
    client.dispose();
  });

  it("로그인 실패는 서버 AUTH_FAILED를 유지하고 중복 세션 종료를 하지 않는다", async () => {
    const reasons: string[] = [];
    const adapter: AxiosAdapter = async (config) =>
      config.url === "/auth/csrf"
        ? response(config, 200, { headerName: "X-CSRF-TOKEN", token: "synthetic-token" })
        : response(config, 401, { code: "AUTH_FAILED", message: "로그인 정보를 확인해 주세요." });
    const client = createHttpClient({ adapter, onSessionChange: (reason) => reasons.push(reason) });
    await expect(client.login("synthetic-user", "synthetic-test-input")).rejects.toMatchObject({
      code: "AUTH_FAILED",
    });
    expect(reasons).toEqual(["login"]);
    client.dispose();
  });

  it("파일 응답도 같은 client로 받고 FormData에 CSRF를 연결한다", async () => {
    const file = new Blob(["synthetic file"], { type: "application/octet-stream" });
    const form = new FormData();
    form.append("file", file, "sample.bin");
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === "/auth/csrf")
        return response(config, 200, { headerName: "X-CSRF-TOKEN", token: "synthetic-token" });
      expect(config.responseType).toBe("blob");
      expect(config.headers.get("X-CSRF-TOKEN")).toBe("synthetic-token");
      expect(config.data).toBe(form);
      return response(config, 200, file);
    };
    const client = createHttpClient({ adapter });
    expect(await client.request<Blob>("/files", "POST", form, { responseType: "blob" })).toBe(file);
    client.dispose();
  });

  it("파일의 작은 JSON 오류는 필드와 세션 종료에 연결한다", async () => {
    const reasons: string[] = [];
    const adapter: AxiosAdapter = async (config) =>
      response(
        config,
        401,
        new Blob([JSON.stringify({ code: "UNAUTHORIZED", message: "로그인 필요" })]),
      );
    const client = createHttpClient({ adapter, onSessionChange: (reason) => reasons.push(reason) });
    await expect(
      client.request("/files/1", "GET", undefined, { responseType: "blob" }),
    ).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "로그인 필요",
    });
    expect(reasons).toEqual(["unauthorized"]);
    client.dispose();
  });

  it("arraybuffer JSON 오류를 해석하고 큰 파일/잘못된 JSON 본문을 노출하지 않는다", async () => {
    const bodies = [
      new TextEncoder().encode(
        JSON.stringify({ code: "VALIDATION", errors: [{ field: "file", message: "크기 오류" }] }),
      ).buffer,
      new Blob(["private-canary".repeat(6000)]),
      new Blob(["not-json-private-canary"]),
    ];
    const adapter: AxiosAdapter = async (config) => response(config, 400, bodies.shift());
    const client = createHttpClient({ adapter });
    await expect(
      client.request("/files/1", "GET", undefined, { responseType: "arraybuffer" }),
    ).rejects.toMatchObject({ code: "VALIDATION", fields: { file: "크기 오류" } });
    for (let index = 0; index < 2; index++)
      await expect(
        client.request("/files/1", "GET", undefined, { responseType: "blob" }),
      ).rejects.toMatchObject({
        code: "HTTP_ERROR",
        message: "요청을 처리하지 못했습니다.",
        fields: {},
      });
    client.dispose();
  });

  it("파일 오류를 비동기 해석하는 중 세션이 바뀌면 이전 401을 폐기한다", async () => {
    let finish: ((text: string) => void) | undefined;
    let started: (() => void) | undefined;
    const decoding = new Promise<void>((resolve) => {
      started = resolve;
    });
    const body = new Blob(["synthetic"]);
    body.text = () =>
      new Promise((resolve) => {
        finish = resolve;
        started?.();
      });
    const reasons: string[] = [];
    const adapter: AxiosAdapter = async (config) => response(config, 401, body);
    const client = createHttpClient({ adapter, onSessionChange: (reason) => reasons.push(reason) });
    const pending = client.request("/files/1", "GET", undefined, { responseType: "blob" });
    const rejected = expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    await decoding;
    client.resetSession();
    finish?.('{"code":"UNAUTHORIZED"}');
    await rejected;
    expect(reasons).toEqual(["reset"]);
    client.dispose();
  });

  it("별도 소비 앱 runtime의 캐시와 Pinia를 공유하지 않는다", () => {
    const first = createFrameworkRuntime({ routes: [], history: createMemoryHistory() });
    const second = createFrameworkRuntime({ routes: [], history: createMemoryHistory() });
    first.queryClient.setQueryData(["examples"], ["first-only"]);
    first.session.identity = { username: "synthetic-user", roles: ["ADMIN"] };
    expect(second.queryClient.getQueryData(["examples"])).toBeUndefined();
    expect(second.session.identity).toBeNull();
    first.dispose();
    second.dispose();
  });

  it("실제 Axios 오류 분기의 파일 CSRF는 자동 재시도 없이 다음 제출에서 갱신한다", async () => {
    let tokens = 0;
    let writes = 0;
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === "/auth/csrf")
        return response(config, 200, {
          headerName: "X-CSRF-TOKEN",
          token: `synthetic-${++tokens}`,
        });
      writes++;
      if (writes === 1)
        throw new AxiosError(
          "synthetic",
          "ERR_BAD_REQUEST",
          config,
          undefined,
          response(config, 403, new Blob(['{"code":"CSRF","message":"보안 토큰 오류"}'])),
        );
      return response(config, 200, new Blob(["synthetic"]));
    };
    const client = createHttpClient({ adapter });
    await expect(
      client.request("/files", "POST", new FormData(), { responseType: "blob" }),
    ).rejects.toMatchObject({ code: "CSRF", status: 403 });
    expect(writes).toBe(1);
    await client.request("/files", "POST", new FormData(), { responseType: "blob" });
    expect(tokens).toBe(2);
    expect(writes).toBe(2);
    client.dispose();
  });
});
