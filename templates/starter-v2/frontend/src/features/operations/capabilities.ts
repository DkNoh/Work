/**
 * 생성 앱 v2의 운영 capability/오류 수집 연결이다. 생성 앱의 등록 라우트 코드와 자체 appVersion을 사용한다.
 * 모든 HTTP는 이 앱의 runtime.client 한 개를 경유한다. Query/세션 수명과 서버 기능 활성 여부를 기준으로 기능을 연결한다.
 * 공통 패키지 또는 다른 업무 앱의 내부 src를 import하지 않는다. API 타입은 컴파일 계약이고 실제 권한/유효성은 서버가 검사한다.
 */
import { computed, watch, type App } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  createBrowserErrorCollector,
  useFrameworkRuntime,
  type FrameworkRuntime,
} from "@sc/runtime";
import { createOperationsApi, operationKeys, type FrameworkCapabilities } from "./api";

export function useOperationsAccess() {
  const runtime = useFrameworkRuntime();
  const api = createOperationsApi(runtime);
  const query = useQuery({
    queryKey: operationKeys.capabilities,
    queryFn: ({ signal }) => api.capabilities(signal),
    enabled: computed(() => !!runtime.session.identity),
  });
  const admin = computed(() => runtime.session.identity?.roles.includes("ADMIN") === true);
  return {
    query,
    admin,
    messaging: computed(
      () => query.isSuccess.value && admin.value && query.data.value?.messaging === true,
    ),
    scheduler: computed(
      () => query.isSuccess.value && admin.value && query.data.value?.scheduler === true,
    ),
    browserErrors: computed(
      () => query.isSuccess.value && admin.value && query.data.value?.browserErrors === true,
    ),
  };
}

/**
 * 세션/Query 구독으로 수집기를 중복 없이 설치/폐기한다. app.onUnmount에서 구독과 collector를 정리하고 원문 URL/입력을 수집하지 않는다.
 */
export function installOperationsCollector(app: App, runtime: FrameworkRuntime) {
  let collector: ReturnType<typeof createBrowserErrorCollector> | null = null;
  const enabled = () =>
    !!runtime.session.identity &&
    runtime.queryClient.getQueryState(operationKeys.capabilities)?.status === "success" &&
    runtime.queryClient.getQueryData<FrameworkCapabilities>(operationKeys.capabilities)
      ?.browserErrors === true;
  function reconcile() {
    if (!enabled()) {
      collector?.dispose();
      collector = null;
    } else if (!collector)
      collector = createBrowserErrorCollector({
        app,
        client: runtime.client,
        enabled,
        authenticated: () => !!runtime.session.identity,
        appVersion: "1.0.0",
        routeCode: () =>
          typeof runtime.router.currentRoute.value.name === "string"
            ? runtime.router.currentRoute.value.name
            : undefined,
        allowedRoutes: [
          "notes",
          "patterns",
          "operations-messages",
          "operations-schedules",
          "operations-browser-errors",
        ],
      });
  }
  const unsubscribe = runtime.queryClient.getQueryCache().subscribe(reconcile);
  const stop = watch(() => runtime.session.identity, reconcile, { flush: "sync" });
  reconcile();
  app.onUnmount(() => {
    unsubscribe();
    stop();
    collector?.dispose();
  });
}
