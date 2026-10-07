import { createPinia, defineStore, disposePinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type RouterHistory,
} from "vue-router";
import { inject, shallowRef, type App, type InjectionKey, type ShallowRef } from "vue";
import { ApiError, createHttpClient, type HttpClientOptions } from "./http";

export type Identity = { username: string; roles: string[] };
type RuntimeBaseOptions = Pick<HttpClientOptions, "baseURL" | "adapter"> & {
  routes: RouteRecordRaw[];
  history?: RouterHistory;
  unauthorizedPath?: string;
};
export type FrameworkRuntimeOptions<TIdentity extends Identity = Identity> = RuntimeBaseOptions &
  (Identity extends TIdentity
    ? { decodeIdentity?: (payload: unknown) => TIdentity }
    : { decodeIdentity: (payload: unknown) => TIdentity });

function assertIdentity(payload: unknown): asserts payload is Identity {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !("username" in payload) ||
    typeof payload.username !== "string" ||
    !payload.username.trim() ||
    !("roles" in payload) ||
    !Array.isArray(payload.roles) ||
    !payload.roles.every((role: unknown) => typeof role === "string" && role.length > 0)
  )
    throw new Error("Invalid identity response");
}

function decodeDefaultIdentity(payload: unknown): Identity {
  assertIdentity(payload);
  return { username: payload.username, roles: [...payload.roles] };
}

export function createFrameworkRuntime<TIdentity extends Identity = Identity>(
  options: FrameworkRuntimeOptions<TIdentity>,
) {
  // 소비 앱의 추가 사용자 필드도 같은 세션 원본에 둔다. 별도 사용자 store를 만들지 않는다.
  const useSessionStore = defineStore("sc-session", () => {
    const identity = shallowRef<Identity | null>(null) as ShallowRef<TIdentity | null>;
    return { identity };
  });
  const decodeIdentity =
    options.decodeIdentity ?? (decodeDefaultIdentity as (payload: unknown) => TIdentity);
  const pinia = createPinia();
  const session = useSessionStore(pinia);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 } },
  });
  const router = createRouter({
    history: options.history ?? createWebHistory(),
    routes: options.routes,
  });
  let disposed = false;
  const client = createHttpClient({
    baseURL: options.baseURL,
    adapter: options.adapter,
    onSessionChange(reason) {
      session.identity = null;
      void queryClient.cancelQueries();
      queryClient.clear();
      if (reason === "unauthorized" && options.unauthorizedPath) {
        void router.replace(options.unauthorizedPath);
      }
    },
  });

  async function syncIdentity() {
    const epoch = client.getGeneration();
    const payload = await client.request<unknown>("/auth/me");
    if (epoch !== client.getGeneration()) {
      throw new ApiError(
        "로그인 상태가 변경되었습니다. 다시 로그인하세요.",
        401,
        "SESSION_CHANGED",
      );
    }
    let identity: TIdentity;
    try {
      identity = decodeIdentity(payload);
      assertIdentity(identity);
    } catch {
      // 200 응답이어도 잘못된 사용자 형식을 로그인 성공으로 저장하지 않는다.
      if (epoch !== client.getGeneration())
        throw new ApiError(
          "로그인 상태가 변경되었습니다. 다시 로그인하세요.",
          401,
          "SESSION_CHANGED",
        );
      client.resetSession();
      throw new ApiError("사용자 정보의 형식이 올바르지 않습니다.", 502, "INVALID_IDENTITY");
    }
    if (epoch !== client.getGeneration())
      throw new ApiError(
        "로그인 상태가 변경되었습니다. 다시 로그인하세요.",
        401,
        "SESSION_CHANGED",
      );
    session.identity = identity;
    return identity;
  }

  const runtime = {
    pinia,
    session,
    router,
    queryClient,
    client,
    auth: {
      syncIdentity,
      async login(username: string, password: string) {
        await client.login(username, password);
        return syncIdentity();
      },
      logout: client.logout,
    },
    resetSession: client.resetSession,
    dispose() {
      if (disposed) return;
      disposed = true;
      client.dispose();
      queryClient.clear();
      router.options.history.destroy();
      disposePinia(pinia);
    },
    install(app: App) {
      app.use(pinia);
      app.use(VueQueryPlugin, { queryClient });
      app.use(router);
      app.provide(runtimeKey, runtime);
      app.onUnmount(() => runtime.dispose());
    },
  };
  return runtime;
}

export type FrameworkRuntime<TIdentity extends Identity = Identity> = ReturnType<
  typeof createFrameworkRuntime<TIdentity>
>;
const runtimeKey: InjectionKey<FrameworkRuntime> = Symbol("sc-runtime");

export function useFrameworkRuntime<TIdentity extends Identity = Identity>() {
  const runtime = inject(runtimeKey);
  if (!runtime) throw new Error("createFrameworkRuntime으로 앱을 먼저 구성해 주세요.");
  return runtime as FrameworkRuntime<TIdentity>;
}
