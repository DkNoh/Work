/**
 * 서버가 실제 활성화한 운영 기능과 현재 사용자의 ADMIN 역할을 합쳐 화면 접근 여부를 계산한다.
 * 메뉴/화면에서 composable을 여러 번 호출해도 동일 queryKey의 Vue Query 캐시를 사용한다. 최종 접근 제어는 서버 API가 수행한다.
 * 브라우저 오류 수집기는 capability 확인과 로그인 이후에만 설치한다. 원문 message/stack/URL/사용자 입력 대신 허용한 코드만 수집한다.
 */
import { computed, watch, type App } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { createBrowserErrorCollector } from "@sc/runtime";
import { useReferenceRuntime } from "../../auth/identity";
import { createOperationsApi, operationKeys, type FrameworkCapabilities } from "./api";

/**
 * 조회 성공·관리자·서버 기능 활성 세 조건이 모두 참이어야 운영 메뉴를 표시한다. 조회 실패를 기능 활성으로 추정하지 않는다.
 */
export function useOperationsAccess() {
  const runtime = useReferenceRuntime();
  const api = createOperationsApi(runtime);
  const query = useQuery({
    queryKey: operationKeys.capabilities,
    queryFn: ({ signal }) => api.capabilities(signal),
    enabled: computed(() => !!runtime.session.identity),
  });
  const admin = computed(() => runtime.session.identity?.role === "ADMIN");
  const messaging = computed(
    () => query.isSuccess.value && admin.value && query.data.value?.messaging === true,
  );
  const scheduler = computed(
    () => query.isSuccess.value && admin.value && query.data.value?.scheduler === true,
  );
  const browserErrors = computed(
    () => query.isSuccess.value && admin.value && query.data.value?.browserErrors === true,
  );
  return { query, admin, messaging, scheduler, browserErrors };
}

const errorRoutes = [
  "login",
  "dashboard",
  "examples",
  "requests",
  "requirement-report",
  "request-detail",
  "workspace",
  "patterns",
  "admin-users",
  "admin-menus",
  "admin-audit",
  "account",
  "screens",
  "kanban",
  "notices",
  "notices-new",
  "notice-detail",
  "documents",
  "documents-new",
  "document-detail",
  "operations-messages",
  "operations-schedules",
  "operations-browser-errors",
] as const;

/**
 * 앱 시작점에서 한 번 연결한다. Query 캐시와 세션 변화를 감시하여 수집기를 생성/폐기하고 app.unmount 때 구독도 정리한다.
 */
export function installOperationsCollector(
  app: App,
  runtime: ReturnType<typeof useReferenceRuntime>,
) {
  let collector: ReturnType<typeof createBrowserErrorCollector> | null = null;
  function enabled() {
    return (
      !!runtime.session.identity &&
      runtime.queryClient.getQueryState(operationKeys.capabilities)?.status === "success" &&
      runtime.queryClient.getQueryData<FrameworkCapabilities>(operationKeys.capabilities)
        ?.browserErrors === true
    );
  }
  /**
   * 등록 상태를 현재 capability와 일치시킨다. 이미 설치한 수집기를 중복 생성하지 않고 로그아웃/비활성 때 즉시 dispose한다.
   */
  function reconcile() {
    if (!enabled()) {
      collector?.dispose();
      collector = null;
    } else if (!collector) {
      collector = createBrowserErrorCollector({
        app,
        client: runtime.client,
        enabled,
        authenticated: () => !!runtime.session.identity,
        routeCode: () =>
          typeof runtime.router.currentRoute.value.name === "string"
            ? runtime.router.currentRoute.value.name
            : undefined,
        allowedRoutes: errorRoutes,
        appVersion: "0.1.0",
      });
    }
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
