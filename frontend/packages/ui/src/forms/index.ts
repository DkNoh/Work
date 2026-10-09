/*
 * @sc/ui 기본 진입점으로 합쳐지는 폼 행동/확인 dialog export다. 입력 검증·저장 API는 포함하지 않고 부모가 연결할 Props/Emits/Slots만 제공한다.
 * Java package와 달리 폴더 안에 있다고 자동 공개되지 않는다. export는 패키지 경계를 만들고 export type은 실행 코드 없이 타입 검사 정보만 내보낸다.
 */
export { default as ScFormActions } from "./ScFormActions.vue";
export { default as ScConfirmDialog } from "./ScConfirmDialog.vue";
export type {
  ScFormActionsProps,
  ScFormActionsEmits,
  ScFormActionsSlots,
  ScConfirmDialogIntent,
  ScConfirmDialogCancelReason,
  ScConfirmDialogProps,
  ScConfirmDialogEmits,
  ScConfirmDialogSlots,
} from "./form-contracts";
