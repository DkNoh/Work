/*
 * 공통 셸의 메뉴/문구/slot/탐색 이벤트 계약이다. 메뉴는 readonly 배열이며 앱이 route·권한·locale를 기준으로 준비한다.
 *  navigate는 선택 항목을 전달하는 이벤트이고 Router 인스턴스를 받지 않는다. 공통 UI가 앱 구현을 참조하지 않게 하는 경계다.
 *  VNode[] slot은 header/main/sidebar에 부모 콘텐츠를 삽입하는 Vue 구조다. JSP include처럼 재사용하되 부모의 반응형 상태와 이벤트를 유지한다.
 */
import type { VNode } from "vue";

export interface ScAppShellNavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  /** viewBox 0 0 24 24의 장식용 SVG path. 메뉴 이름은 label이 제공한다. */
  readonly iconPath?: string;
  /** 소비 앱에서 번역한 그룹 제목. 연속된 같은 제목의 항목을 묶는다. */
  readonly groupLabel?: string;
}

export interface ScAppShellProps {
  readonly applicationTitle: string;
  readonly applicationLabel?: string;
  readonly navigationLabel?: string;
  readonly navigationItems: readonly ScAppShellNavItem[];
  readonly activeItem: string;
  /** locale 번역은 소비 앱이 소유한다. 생략한 문구는 한국어다. */
  readonly labels?: Partial<ScAppShellLabels>;
}

export interface ScAppShellLabels {
  readonly skipContent: string;
  readonly openNavigation: string;
  readonly closeNavigation: string;
  readonly collapseNavigation?: string;
  readonly expandNavigation?: string;
}

export interface ScAppShellEmits {
  navigate: [item: ScAppShellNavItem];
}

export interface ScAppShellSlots {
  default?(): VNode[];
  "header-actions"?(): VNode[];
  "header-leading"?(): VNode[];
  "sidebar-footer"?(): VNode[];
  notice?(): VNode[];
}
