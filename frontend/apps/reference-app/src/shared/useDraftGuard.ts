// 미저장 입력이 있는 화면의 이동/새로고침을 보호하는 composable이다. dirty는 폼 상태이며 서버 HttpSession과 무관하다.
import { onBeforeUnmount, ref, watch, type ComputedRef } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, type RouteLocationNormalized } from "vue-router";
import { useEventListener } from "@vueuse/core";
import { useReferenceRuntime } from "../auth/identity";

// 호출자는 computed dirty와 선택 동일성 함수를 넘긴다. 기본은 path 비교이므로 query만 달라지는 검색/페이지 이동은 같은 선택이다.
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
  // ((allowed: boolean) => void) | undefined는 대기 중 Promise를 끝내는 함수 또는 없음이라는 타입이다.
  // 확인 창을 여는 순간 저장해 두고 버튼 이벤트가 finish를 호출하면 Router/업무 핸들러의 await가 이어진다.
  let resolve: ((allowed: boolean) => void) | undefined;
  // 중복 완료를 막기 위해 resolver를 먼저 비우고 허용/취소를 반환한다.
  function finish(allowed: boolean) {
    open.value = false;
    const pending = resolve;
    resolve = undefined;
    pending?.(allowed);
  }
  // 이미 창이 열렸으면 새 확인은 false로 끝낸다. 세션이 종료되었으면 만료 처리의 화면 이동을 막지 않는다.
  function confirm(text: string) {
    if (!runtime.session.identity) return Promise.resolve(true);
    if (resolve) return Promise.resolve(false);
    message.value = text;
    open.value = true;
    return new Promise<boolean>((done) => {
      resolve = done;
    });
  }
  // 라우트 guard는 true/false 또는 Promise<boolean>을 받을 수 있다. JSP 전체 새로고침 없이 Router가 이 결과를 기다린다.
  const allowNavigation = () => !runtime.session.identity || !dirty.value || confirm("leave");
  onBeforeRouteLeave(allowNavigation);
  onBeforeRouteUpdate((to, from) => sameSelection(to, from) || allowNavigation());
  // 로그아웃으로 identity가 사라지면 대기 중 확인을 풀어 인증 이동이 멈추지 않게 한다.
  watch(
    () => runtime.session.identity,
    (identity) => {
      if (!identity) finish(true);
    },
  );
  // 탭 닫기/새로고침은 Router 밖의 이동이어서 beforeunload를 사용한다. 브라우저 기본 문구를 쓰며 VueUse가 리스너를 해제한다.
  useEventListener(window, "beforeunload", (event) => {
    if (!runtime.session.identity || !dirty.value) return;
    event.preventDefault();
    event.returnValue = "";
  });
  // 화면이 제거될 때 남은 Promise를 취소로 완료한다. 호출자에게 끝나지 않는 await를 남기지 않는다.
  onBeforeUnmount(() => finish(false));
  return { open, message, confirm, finish };
}
