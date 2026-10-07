import type { VNode } from "vue";
export type ScCardDensity = "comfortable" | "compact";
export type ScSectionCardSurface = "bordered" | "plain";
export type ScKpiCardTone = "green" | "violet" | "pink" | "amber";
export type ScKpiTrendDirection = "up" | "down" | "neutral";
export interface ScKpiCardProps {
  /** 지표의 이름. 카드의 접근성 이름으로도 사용한다. */
  label: string;
  /** 숫자·단위·통화 형식은 소비 앱에서 결정한다. */
  value: string;
  note?: string;
  /** 증가·감소의 의미를 포함하는 완결된 표시 문구를 전달한다. */
  trend?: string;
  /** 방향은 장식이며 업무상 좋은 변화인지 판단하지 않는다. */
  trendDirection?: ScKpiTrendDirection;
  tone?: ScKpiCardTone;
  /** compact는 좁은 대시보드 열에서도 같은 지표 구성을 유지한다. */
  density?: ScCardDensity;
  /** SVG path 데이터. 작은 아이콘과 큰 배경 장식은 읽기 순서에서 제외한다. */
  iconPath?: string;
}
export type ScKpiCardSlots = Record<string, never>;
export interface ScPageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}
export interface ScPageHeaderSlots {
  actions?: () => VNode[];
}
export interface ScSectionCardProps {
  title: string;
  description?: string;
  density?: ScCardDensity;
  /** plain도 배경·그림자는 유지하며 카드와 헤더의 구분선을 생략한다. */
  surface?: ScSectionCardSurface;
}
export interface ScSectionCardSlots {
  default?: () => VNode[];
  actions?: () => VNode[];
}
export type ScStatusBadgeTone =
  "neutral" | "primary" | "secondary" | "success" | "warning" | "danger" | "info";
export interface ScStatusBadgeProps {
  /** 상태는 색상 외에도 실제 텍스트로 전달한다. */
  label: string;
  tone?: ScStatusBadgeTone;
}
export type ScStatusBadgeSlots = Record<string, never>;
export interface ScSearchPanelProps {
  label?: string;
  submitLabel?: string;
  resetLabel?: string;
  disabled?: boolean;
}
export interface ScSearchPanelEmits {
  submit: [event: SubmitEvent];
  reset: [event: Event];
}
export interface ScSearchPanelSlots {
  default?: () => VNode[];
  actions?: () => VNode[];
}
export interface ScErrorPanelProps {
  message: string;
  title?: string;
  retryLabel?: string;
  showRetry?: boolean;
}
export interface ScErrorPanelEmits {
  retry: [];
}
export interface ScEmptyStateProps {
  title?: string;
  message?: string;
}
export interface ScEmptyStateSlots {
  actions?: () => VNode[];
}
export interface ScLoadingStateProps {
  label?: string;
}
export interface ScListDetailLayoutProps {
  detailVisible?: boolean;
  listLabel?: string;
  detailLabel?: string;
  backLabel?: string;
}
export interface ScListDetailLayoutEmits {
  "show-list": [];
}
export interface ScListDetailLayoutSlots {
  header?: () => VNode[];
  search?: () => VNode[];
  toolbar?: () => VNode[];
  list?: () => VNode[];
  detail?: () => VNode[];
}
