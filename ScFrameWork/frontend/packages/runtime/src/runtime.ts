/**
 * 소비 앱 하나에 필요한 Router·Pinia·Vue Query·HTTP를 조립하는 진입점이다.
 * JSP의 서버 요청마다 화면을 새로 만드는 방식과 달리 SPA 인스턴스가 살아 있는 동안 유지된다.
 * URL은 Router, 서버 조회 캐시는 QueryClient, 현재 사용자라는 공유 상태는 Pinia가 소유한다.
 * 업무 폼의 미저장 입력이나 업무별 DTO/권한 판단은 이 공통 runtime에 넣지 않는다.
 */
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

// type/interface는 Java DTO와 비슷한 정적 모양 계약이다. JSON을 런타임에 검증하지는 않는다.
export type Identity = { username: string; roles: string[] };
type RuntimeBaseOptions = Pick<HttpClientOptions, "baseURL" | "adapter"> & {
  routes: RouteRecordRaw[];
  history?: RouterHistory;
  unauthorizedPath?: string;
};
// TIdentity는 기본 사용자 계약을 확장하는 제네릭이다. 앱이 추가 필드를 요구하면
// 조건부 타입이 decodeIdentity도 필수로 만들어 공통 응답을 무검증 단언하지 않게 한다.
export type FrameworkRuntimeOptions<TIdentity extends Identity = Identity> = RuntimeBaseOptions &
  (Identity extends TIdentity
    ? { decodeIdentity?: (payload: unknown) => TIdentity }
    : { decodeIdentity: (payload: unknown) => TIdentity });

// 외부 JSON은 unknown으로 받아 실제 값을 확인한다. `asserts ... is ...`는 이 함수가
// 정상 종료한 뒤 TypeScript가 payload를 Identity로 취급하도록 돕는 타입 좁히기다.
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
  // roles 배열도 복사해 서버 응답 객체와 세션에서 사용하는 객체의 참조를 분리한다.
  return { username: payload.username, roles: [...payload.roles] };
}

/**
 * routes와 선택 설정을 받아 독립적인 runtime을 반환한다. 이 호출만으로 Vue 앱에 설치되지는 않는다.
 * 앱 시작 코드에서 app.use(runtime)를 호출하면 아래 install이 플러그인들을 연결한다.
 * 여러 앱/테스트가 모듈 전역의 로그인 상태나 조회 캐시를 공유하지 않도록 매번 새로 생성한다.
 */
export function createFrameworkRuntime<TIdentity extends Identity = Identity>(
  options: FrameworkRuntimeOptions<TIdentity>,
) {
  // 소비 앱의 추가 사용자 필드도 같은 세션 원본에 둔다. 별도 사용자 store를 만들지 않는다.
  const useSessionStore = defineStore("sc-session", () => {
    // shallowRef는 .value 자체 교체를 반응형으로 추적한다. 사용자 내부 필드의 직접 변경 대신
    // 로그인/동기화 때 객체 전체를 교체한다. Pinia로 읽는 session.identity는 ref가 자동 해제된다.
    // ShallowRef는 `type` import이므로 브라우저 실행 코드에는 포함되지 않는다.
    const identity = shallowRef<Identity | null>(null) as ShallowRef<TIdentity | null>;
    return { identity };
  });
  const decodeIdentity =
    options.decodeIdentity ?? (decodeDefaultIdentity as (payload: unknown) => TIdentity);
  const pinia = createPinia();
  const session = useSessionStore(pinia);
  // 서버 자료의 원본은 서버이며 Query는 그 캐시다. 여기서는 실패 자동 재시도와 창 복귀 시
  // 자동 재조회를 끄고 15초 신선도를 기본값으로 둔다. 개별 업무 Query에서 재정의할 수 있다.
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
      // A 사용자 응답/캐시가 B 사용자에게 보이지 않도록 세션 변경 시 공통 원본을 함께 비운다.
      // void는 Promise를 반환받되 이 콜백에서 기다리지 않는다는 표시이며 await와 다르다.
      session.identity = null;
      void queryClient.cancelQueries();
      queryClient.clear();
      if (reason === "unauthorized" && options.unauthorizedPath) {
        void router.replace(options.unauthorizedPath);
      }
    },
  });

  // /auth/me를 읽고 검증한 결과만 세션 원본에 반영한다. Promise의 await 전후에는 다른
  // 로그인/로그아웃이 실행될 수 있으므로 요청 시작 때의 generation(epoch)을 다시 비교한다.
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
      // 앱 decoder는 추가 필드를 확인하고, 공통 검사는 username/roles의 최소 계약을 확인한다.
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
        // 서버 쿠키 세션을 먼저 만든 뒤 현재 사용자 응답으로 Pinia를 채운다.
        // 비밀번호를 store에 보관하지 않으며 화면은 이 Promise의 완료/오류를 처리한다.
        await client.login(username, password);
        return syncIdentity();
      },
      logout: client.logout,
    },
    resetSession: client.resetSession,
    dispose() {
      // 명시적인 종료와 app unmount 양쪽에서 호출해도 한 번만 정리하는 멱등 처리다.
      // HTTP 중단, 서버 캐시 제거, history 이벤트 해제, Pinia scope 정리를 함께 수행한다.
      if (disposed) return;
      disposed = true;
      client.dispose();
      queryClient.clear();
      router.options.history.destroy();
      disposePinia(pinia);
    },
    install(app: App) {
      // app.use는 앱 단위 플러그인 등록, provide는 하위 컴포넌트에 같은 객체를 주입하는 통로다.
      // onUnmount는 앱 전체 종료의 생명주기다. 페이지 전환만으로 runtime을 폐기하지 않는다.
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
// Symbol 키는 다른 라이브러리의 문자열 키와 충돌하지 않는다. InjectionKey의 제네릭은
// provide/inject의 타입을 맞추며 실제 사용자 데이터의 검증은 위 decoder가 담당한다.
const runtimeKey: InjectionKey<FrameworkRuntime> = Symbol("sc-runtime");

/**
 * 컴포넌트 setup/composable에서 상위 앱이 설치한 runtime을 가져온다. 새 store/client를 만들지 않는다.
 * TIdentity는 생성할 때 선택한 사용자 타입과 같아야 하며, 여기의 as는 새 런타임 검사가 아니다.
 */
export function useFrameworkRuntime<TIdentity extends Identity = Identity>() {
  const runtime = inject(runtimeKey);
  if (!runtime) throw new Error("createFrameworkRuntime으로 앱을 먼저 구성해 주세요.");
  return runtime as FrameworkRuntime<TIdentity>;
}
