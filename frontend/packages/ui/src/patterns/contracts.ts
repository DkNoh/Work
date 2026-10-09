/*
 * 카드·페이지 헤더·검색·조회 상태·목록/상세 배치의 공개 화면 패턴 계약이다. 공통 패턴이 소유하지 않을 업무 상태를 props/events로 경계 짓는다.
 *  string union은 density/tone처럼 허용된 표현을 제한하고, optional slot은 부모가 제공할 수 있는 화면 영역을 뜻한다.
 *  VNode[] 반환 함수는 Vue slot 타입이다. API 응답 DTO와 달리 이 계약에는 조회/저장 메서드나 업무 권한 규칙이 없다.
 */
import type { VNode } from "vue";
export type ScCardDensity = "comfortable" | "compact";
export type ScSectionCardSurface = "bordered" | "plain";
export type ScKpiCardTone = "green" | "violet" | "pink" | "amber";
export type ScKpiTrendDirection = "up" | "down" | "neutral";
// KPI는 숫자가 아닌 표시 문자열을 받아 앱의 단위·통화·locale 결정을 보존한다.
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
// 이름별 튜플 타입으로 이벤트의 인자를 정의한다. submit/reset은 DOM 이벤트, retry/show-list는 의도만 전달한다.
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
// slot의 이름이 화면 구역의 계약이다. 부모가 list/detail 내부를 자유롭게 조립해도 공통 부품이 업무 구현을 import하지 않는다.
export interface ScListDetailLayoutSlots {
  header?: () => VNode[];
  search?: () => VNode[];
  toolbar?: () => VNode[];
  list?: () => VNode[];
  detail?: () => VNode[];
}
