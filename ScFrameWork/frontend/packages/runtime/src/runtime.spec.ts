import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { createMemoryHistory } from "vue-router";
import { createFrameworkRuntime, type FrameworkRuntimeOptions, type Identity } from "./runtime";

function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { config, status: 200, data, statusText: "200", headers: {} };
}

type ConsumerIdentity = Identity & { id: number; displayName: string; role: "ADMIN" };

const consumerOptions: FrameworkRuntimeOptions<ConsumerIdentity> = {
  routes: [],
  decodeIdentity(payload) {
    if (!payload || typeof payload !== "object" || !("id" in payload))
      throw new Error("Invalid consumer identity");
    const user = payload as { id: unknown; username: unknown; displayName: unknown; role: unknown };
    if (
      typeof user.id !== "number" ||
      !Number.isSafeInteger(user.id) ||
      user.id <= 0 ||
      typeof user.username !== "string" ||
      typeof user.displayName !== "string" ||
      user.role !== "ADMIN"
    )
      throw new Error("Invalid consumer identity");
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      roles: [user.role],
    };
  },
};

describe("소비 앱 세션 응답 확장", () => {
  it("기본 username/roles와 소비 앱의 숫자 ID/역할을 독립된 한 세션에 저장한다", async () => {
    const originalUser = {
      id: 37,
      username: "consumer-admin",
      displayName: "합성 관리자",
      role: "ADMIN",
    };
    const first = createFrameworkRuntime<ConsumerIdentity>({
      ...consumerOptions,
      history: createMemoryHistory(),
      adapter: async (config) => response(config, originalUser),
    });
    const second = createFrameworkRuntime({
      routes: [],
      history: createMemoryHistory(),
      adapter: async (config) => response(config, { username: "starter", roles: ["ADMIN"] }),
    });
    try {
      const user = await first.auth.syncIdentity();
      expectTypeOf(user).toEqualTypeOf<ConsumerIdentity>();
      expectTypeOf(first.session.identity).toEqualTypeOf<ConsumerIdentity | null>();
      expect(user).toEqual({ ...originalUser, roles: ["ADMIN"] });
      expect(first.session.identity).toEqual(user);
      expect(second.session.identity).toBeNull();
      await second.auth.syncIdentity();
      expect(second.session.identity).toEqual({ username: "starter", roles: ["ADMIN"] });
      expect(first.session.identity?.id).toBe(37);
      expect(originalUser).not.toHaveProperty("roles");
    } finally {
      first.dispose();
      second.dispose();
    }
  });

  it.each([
    null,
    [],
    { username: "", roles: [] },
    { username: "admin", roles: "ADMIN" },
    { username: "admin", roles: [42] },
  ])("200의 잘못된 기본 identity %j는 기존 사용자와 조회 캐시를 초기화한다", async (payload) => {
    const runtime = createFrameworkRuntime({
      routes: [],
      history: createMemoryHistory(),
      adapter: async (config) => response(config, payload),
    });
    try {
      runtime.session.identity = { username: "previous-user", roles: ["ADMIN"] };
      runtime.queryClient.setQueryData(["private-previous-user"], ["synthetic-data"]);
      const previousGeneration = runtime.client.getGeneration();
      await expect(runtime.auth.syncIdentity()).rejects.toMatchObject({
        status: 502,
        code: "INVALID_IDENTITY",
      });
      expect(runtime.session.identity).toBeNull();
      expect(runtime.queryClient.getQueryData(["private-previous-user"])).toBeUndefined();
      expect(runtime.client.getGeneration()).toBe(previousGeneration + 1);
    } finally {
      runtime.dispose();
    }
  });

  it("소비 decoder가 거절한 actor 응답을 저장하지 않고 원문 오류를 노출하지 않는다", async () => {
    const runtime = createFrameworkRuntime<ConsumerIdentity>({
      ...consumerOptions,
      history: createMemoryHistory(),
      adapter: async (config) =>
        response(config, { id: 0, username: "admin", displayName: "합성", role: "ADMIN" }),
    });
    try {
      await expect(runtime.auth.syncIdentity()).rejects.toMatchObject({
        code: "INVALID_IDENTITY",
        message: "사용자 정보의 형식이 올바르지 않습니다.",
      });
      expect(runtime.session.identity).toBeNull();
    } finally {
      runtime.dispose();
    }
  });

  it("새 세션이 동기화된 뒤 도착한 이전 me가 숫자 actor와 캐시를 덮어쓰지 않는다", async () => {
    let finishPrevious: (() => void) | undefined;
    let calls = 0;
    const adapter: AxiosAdapter = (config) => {
      calls += 1;
      if (calls === 1)
        return new Promise((resolve) => {
          finishPrevious = () =>
            resolve(
              response(config, { id: 1, username: "previous", displayName: "이전", role: "ADMIN" }),
            );
        });
      return Promise.resolve(
        response(config, { id: 2, username: "current", displayName: "현재", role: "ADMIN" }),
      );
    };
    const runtime = createFrameworkRuntime<ConsumerIdentity>({
      ...consumerOptions,
      history: createMemoryHistory(),
      adapter,
    });
    try {
      const previous = runtime.auth.syncIdentity();
      const rejected = expect(previous).rejects.toMatchObject({ code: "SESSION_CHANGED" });
      await vi.waitFor(() => expect(finishPrevious).toBeTypeOf("function"));
      runtime.resetSession();
      await runtime.auth.syncIdentity();
      runtime.queryClient.setQueryData(["current-private-list"], ["current-owned"]);
      finishPrevious?.();
      await rejected;
      expect(runtime.session.identity?.id).toBe(2);
      expect(runtime.session.identity?.username).toBe("current");
      expect(runtime.queryClient.getQueryData(["current-private-list"])).toEqual(["current-owned"]);
    } finally {
      runtime.dispose();
    }
  });
});
