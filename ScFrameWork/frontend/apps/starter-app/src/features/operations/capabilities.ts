/**
 * 서버 capability 조회와 공통 Identity.roles를 결합하여 운영 기능 표시 여부를 계산한다. Query 캐시는 동일 키로 공유한다.
 * 브라우저 오류 수집은 로그인 상태와 서버 기능 활성 후에만 연결한다. allowedRoutes는 등록된 코드 목록이며 원문 URL/stack/입력 수집을 허용하지 않는다.
 */
import { computed, watch, type App } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  createBrowserErrorCollector,
  useFrameworkRuntime,
  type FrameworkRuntime,
} from "@sc/runtime";
import { createOperationsApi, operationKeys, type FrameworkCapabilities } from "./api";

/**
 * 서버 응답 성공·ADMIN 역할·기능 활성 조건이 모두 만족되어야 각 운영 패널에 접근한다. 최종 권한은 서버가 검사한다.
 */
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
 * 앱 단위 설치 함수다. 세션/Query 구독으로 collector 생성을 조정하고 app.onUnmount에서 구독과 리스너를 정리한다.
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
        appVersion: "0.1.0",
        routeCode: () =>
          typeof runtime.router.currentRoute.value.name === "string"
            ? runtime.router.currentRoute.value.name
            : undefined,
        allowedRoutes: [
          "start",
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
