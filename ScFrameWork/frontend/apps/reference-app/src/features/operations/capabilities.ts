import { computed, watch, type App } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { createBrowserErrorCollector } from "@sc/runtime";
import { useReferenceRuntime } from "../../auth/identity";
import { createOperationsApi, operationKeys, type FrameworkCapabilities } from "./api";

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
