/*
 * 선택·체크·여러 줄 입력의 공통 Props/Emits 계약이다. Java의 interface extends처럼 공통 필드 표현과 포커스 이벤트를 재사용한다.
 *  readonly는 자식이 전달받은 값을 변경하지 않도록 컴파일 단계에서 제한한다. 런타임 deep freeze나 서버 검증을 대신하지 않는다.
 *  입력 모델은 Select:string|null, Checkbox:boolean, TextArea:string으로 고정한다. Record<string, never>는 공개 slot이 없다는 뜻이다.
 */
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
// update:modelValue는 v-model 갱신 요청, change는 선택 확정 알림이다. change 인자는 DOM Event가 아니라 선택값이다.
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

// rows/autoGrow는 렌더링 옵션이다. 업무 입력 검증의 소유권은 이 타입을 소비하는 폼에 남는다.
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
