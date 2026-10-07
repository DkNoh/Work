import { onBeforeUnmount, ref, watch, type ComputedRef } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, type RouteLocationNormalized } from "vue-router";
import { useEventListener } from "@vueuse/core";
import { useReferenceRuntime } from "../auth/identity";

export function useDraftGuard(
  dirty: ComputedRef<boolean>,
  sameSelection: (to: RouteLocationNormalized, from: RouteLocationNormalized) => boolean = (
    to,
    from,
  ) => to.path === from.path,
) {
  const runtime = useReferenceRuntime();
  const open = ref(false);
  const message = ref("");
  let resolve: ((allowed: boolean) => void) | undefined;
  function finish(allowed: boolean) {
    open.value = false;
    const pending = resolve;
    resolve = undefined;
    pending?.(allowed);
  }
  function confirm(text: string) {
    if (!runtime.session.identity) return Promise.resolve(true);
    if (resolve) return Promise.resolve(false);
    message.value = text;
    open.value = true;
    return new Promise<boolean>((done) => {
      resolve = done;
    });
  }
  const allowNavigation = () => !runtime.session.identity || !dirty.value || confirm("leave");
  onBeforeRouteLeave(allowNavigation);
  onBeforeRouteUpdate((to, from) => sameSelection(to, from) || allowNavigation());
  watch(
    () => runtime.session.identity,
    (identity) => {
      if (!identity) finish(true);
    },
  );
  useEventListener(window, "beforeunload", (event) => {
    if (!runtime.session.identity || !dirty.value) return;
    event.preventDefault();
    event.returnValue = "";
  });
  onBeforeUnmount(() => finish(false));
  return { open, message, confirm, finish };
}
