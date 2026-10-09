/*
 * 기본 버튼·문자열 입력의 공개 TypeScript 계약과 HTML 속성 필터다. Java interface처럼 사용 위치의 형태를 검사한다.
 *  리터럴 union(예: button|submit|reset)은 허용 문자열을 제한한다. ?는 선택 입력, [event: MouseEvent]는 emit 인자의 튜플 타입이다.
 *  import type은 타입 참조만 가져온다. VNode[]는 부모가 slot에 넣을 Vue 화면 노드 목록이며 서버 HTML 문자열이 아니다.
 */
import type { HTMLAttributes, VNode } from "vue";

export type ScActionButtonType = "button" | "submit" | "reset";
export type ScActionButtonVariant = "flat" | "text" | "outlined" | "tonal";
export type ScActionButtonSize = "sm" | "md" | "lg";
export type ScActionButtonIntent =
  "primary" | "secondary" | "success" | "warning" | "danger" | "neutral";
export type ScControlDensity = "comfortable" | "compact";

export interface ScActionButtonProps {
  /** 처리 중에는 클릭과 native form 기본 동작을 제한한다. */
  busy?: boolean;
  /** 처리 중 표시와 progressbar의 접근성 이름. */
  busyLabel?: string;
  disabled?: boolean;
  /** 폼 제출은 submit을 명시한다. 기본값은 button이다. */
  type?: ScActionButtonType;
  color?: string;
  variant?: ScActionButtonVariant;
  /** 32/38/44px 높이와 아이콘·글자·여백을 함께 선택한다. */
  size?: ScActionButtonSize;
  /** 의미 색상. 기존 color를 명시하면 그 값이 우선한다. */
  intent?: ScActionButtonIntent;
  /** 장식 SVG path. 접근성 이름은 버튼의 콘텐츠 또는 aria-label/title이 맡는다. */
  iconPath?: string;
  /** iconPath와 비어 있지 않은 aria-label 또는 title을 함께 제공해야 한다. */
  iconOnly?: boolean;
}
export interface ScActionButtonEmits {
  /** 활성 버튼의 native 클릭. 같은 렌더 주기의 재진입은 한 번만 전달한다. */
  click: [event: MouseEvent];
}
export interface ScActionButtonSlots {
  /** 동작 이름 또는 접근성 이름이 있는 사용자 콘텐츠. */
  default?: () => VNode[];
}

export type ScTextFieldType =
  | "text"
  | "password"
  | "email"
  | "search"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "datetime-local"
  | "time"
  | "month"
  | "week";
export type ScTextFieldInputMode =
  "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
export interface ScTextFieldProps {
  /** 부모가 소유하는 입력값. 읽기 전용 상태에서도 부모의 새 값을 표시한다. */
  modelValue: string;
  /** placeholder와 별도로 유지하는 필드 이름. */
  label: string;
  /** 생략하면 인스턴스별 ID를 생성하고 label과 오류 설명에 연결한다. */
  id?: string;
  errorMessages?: string | readonly string[];
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  type?: ScTextFieldType;
  name?: string;
  autocomplete?: string;
  form?: string;
  placeholder?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  inputMode?: ScTextFieldInputMode;
  autofocus?: boolean;
  /** 기본 comfortable을 보존하고 좁은 조회 폼에서 compact를 선택한다. */
  density?: ScControlDensity;
}
export interface ScTextFieldEmits {
  /** 편집 가능한 필드의 변경값. disabled/readonly에서는 전달하지 않는다. */
  "update:modelValue": [value: string];
  focus: [event: FocusEvent];
  blur: [event: FocusEvent];
  keydown: [event: KeyboardEvent];
  keyup: [event: KeyboardEvent];
  input: [event: Event];
  change: [event: Event];
}
/** 입력은 model·label·오류를 공개하며 내부 Vuetify 슬롯을 전달하지 않는다. */
export type ScTextFieldSlots = Record<string, never>;

/** props 이외에 허용하는 공통 DOM 속성. ARIA와 data 속성의 DOM 대상은 각 부품의 계약을 따른다. */
// aria-${string}/data-${string}는 해당 접두사를 가진 속성만 받는 템플릿 리터럴 타입이다. 일반 vendor props까지 허용하지 않는다.
export interface ScHtmlAttrs {
  id?: string;
  class?: HTMLAttributes["class"];
  style?: HTMLAttributes["style"];
  title?: string;
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
  role?: string;
  tabindex?: number | string;
  [name: `aria-${string}`]: string | number | boolean | null | undefined;
  [name: `data-${string}`]: string | number | boolean | null | undefined;
}

const globalAttributes = new Set([
  "id",
  "class",
  "style",
  "title",
  "lang",
  "dir",
  "role",
  "tabindex",
]);
interface HtmlAttrOptions {
  attributes?: readonly string[];
  events?: readonly string[];
  omit?: readonly string[];
}

/** 내부 정책: 화면의 임의 Vuetify props나 callback이 래퍼를 우회하지 못하게 한다. */
export function pickScHtmlAttrs(
  attrs: Readonly<Record<string, unknown>>,
  options: HtmlAttrOptions = {},
): Record<string, unknown> {
  // 각 부품이 추가 허용한 속성과 공통 DOM 속성을 합친다. Set은 빠른 중복 제거와 이름 조회에 사용한다.
  const allowed = new Set([
    ...globalAttributes,
    ...(options.attributes ?? []),
    ...(options.events ?? []),
  ]);
  // omit을 먼저 적용해 내부에서 계산한 ARIA 값이 외부 attrs로 덮이지 않게 한다.
  const omitted = new Set(options.omit ?? []);
  return Object.fromEntries(
    Object.entries(attrs).filter(
      ([name]) =>
        !omitted.has(name) &&
        (allowed.has(name) ||
          /^aria-[a-z][a-z\d-]*$/.test(name) ||
          /^data-[a-z][a-z\d-]*$/.test(name)),
    ),
  );
}
