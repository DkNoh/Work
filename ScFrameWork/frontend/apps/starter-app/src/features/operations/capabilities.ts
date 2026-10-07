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
