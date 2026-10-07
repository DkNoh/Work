import type { ScControlDensity, ScTextFieldInputMode } from "../contracts";

/** 검증 결과는 소비 폼이 소유하고 입력은 이름·오류·편집 상태를 표시한다. */
export interface ScInputPresentationProps {
  readonly label: string;
  readonly id?: string;
  readonly errorMessages?: string | readonly string[];
  readonly hint?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly name?: string;
  readonly form?: string;
  readonly autofocus?: boolean;
}

export interface ScInputFocusEmits {
  focus: [event: FocusEvent];
  blur: [event: FocusEvent];
  keydown: [event: KeyboardEvent];
  keyup: [event: KeyboardEvent];
}

/** 단일 선택값의 안정적 ID. 옵션·표시 이름은 자식에서 변경하지 않는다. */
export interface ScSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}
export interface ScSelectProps extends ScInputPresentationProps {
  readonly modelValue: string | null;
  readonly options: readonly ScSelectOption[];
  readonly placeholder?: string;
  readonly clearable?: boolean;
  /** 옵션 조회 상태만 표시한다. 조회 요청은 소비 앱이 실행한다. */
  readonly loading?: boolean;
  readonly emptyLabel?: string;
  readonly density?: ScControlDensity;
  /** field는 업무 입력, toolbar는 같은 계약의 native 단일 선택이다. */
  readonly presentation?: "field" | "toolbar";
  readonly tone?: "surface" | "primary" | "secondary";
}
export interface ScSelectEmits extends ScInputFocusEmits {
  "update:modelValue": [value: string | null];
  /** 편집 가능한 선택의 확정값. native input Event와 구분한다. */
  change: [value: string | null];
}
export type ScSelectSlots = Record<string, never>;

export interface ScCheckboxProps extends ScInputPresentationProps {
  readonly modelValue: boolean;
}
export interface ScCheckboxEmits extends ScInputFocusEmits {
  "update:modelValue": [value: boolean];
  input: [event: Event];
  change: [event: Event];
}
export type ScCheckboxSlots = Record<string, never>;

export interface ScTextAreaProps extends ScInputPresentationProps {
  readonly modelValue: string;
  readonly placeholder?: string;
  readonly autocomplete?: string;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly inputMode?: ScTextFieldInputMode;
  /** 줄 수는 표시 기준이며 업무 글자 수 규칙을 대신하지 않는다. */
  readonly rows?: number;
  readonly autoGrow?: boolean;
  readonly maxRows?: number;
  readonly density?: ScControlDensity;
}
export interface ScTextAreaEmits extends ScInputFocusEmits {
  "update:modelValue": [value: string];
  input: [event: Event];
  change: [event: Event];
}
export type ScTextAreaSlots = Record<string, never>;
