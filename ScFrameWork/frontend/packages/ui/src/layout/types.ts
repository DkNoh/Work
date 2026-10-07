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
