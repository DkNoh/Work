/*
 * 셸과 메뉴/slot/이벤트 계약만 외부에 공개한다. 내부 메뉴 렌더링 ScShellNavigation은 공개하지 않아 소비 앱이 내부 구현에 의존하지 않게 한다.
 * Java package와 달리 폴더 안에 있다고 자동 공개되지 않는다. export는 패키지 경계를 만들고 export type은 실행 코드 없이 타입 검사 정보만 내보낸다.
 */
export { default as ScAppShell } from "./ScAppShell.vue";
export type {
  ScAppShellNavItem,
  ScAppShellProps,
  ScAppShellEmits,
  ScAppShellSlots,
  ScAppShellLabels,
} from "./types";
