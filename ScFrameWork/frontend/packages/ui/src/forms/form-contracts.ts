import type { VNode } from "vue";

/** 버튼 배치만 소유한다. native form과 submit 처리·검증은 부모의 책임이다. */
export interface ScFormActionsProps {
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly submitLabel?: string;
  readonly cancelLabel?: string;
  readonly busyLabel?: string;
  readonly showCancel?: boolean;
  /** form 밖에 배치할 때 연결할 native form ID. */
  readonly form?: string;
}
export interface ScFormActionsEmits {
  cancel: [event: MouseEvent];
}
export interface ScFormActionsSlots {
  /** 설명·저장 상태처럼 버튼과 함께 보여 줄 콘텐츠. */
  notice?: () => VNode[];
  /** 소비 폼이 소유하는 추가 행동. 기본 제출·취소 버튼을 대체하지 않는다. */
  secondary?: () => VNode[];
}

export type ScConfirmDialogIntent = "default" | "danger";
export type ScConfirmDialogCancelReason = "button" | "escape" | "backdrop";
export interface ScConfirmDialogProps {
  readonly modelValue: boolean;
  readonly title: string;
  readonly message?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly busyLabel?: string;
  /** 사용자 확인·취소·Escape·배경 닫기를 제한한다. 부모의 명시적인 model 교체는 허용한다. */
  readonly busy?: boolean;
  readonly intent?: ScConfirmDialogIntent;
  readonly id?: string;
}
export interface ScConfirmDialogEmits {
  /** 취소의 닫기 요청. props를 변경하지 않고 실제 닫힘은 부모 값 반영을 기다린다. */
  "update:modelValue": [value: boolean];
  /** 확인 후 저장/삭제·성공 시 닫기·실패 시 유지 정책은 부모가 결정한다. */
  confirm: [];
  cancel: [reason: ScConfirmDialogCancelReason];
}
export interface ScConfirmDialogSlots {
  /** message 뒤의 추가 안내. 복잡한 본문은 스스로 의미 구조를 유지한다. */
  default?: () => VNode[];
}
