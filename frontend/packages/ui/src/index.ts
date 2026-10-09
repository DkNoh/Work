/*
 * @sc/ui 기본 진입점: 버튼·입력·폼·화면 패턴·셸과 theme/tokens를 외부 앱에 공개한다. 차트·표·에디터 등 확장 기능은 각각 별도 subpath에서 소비한다.
 * Java package와 달리 폴더 안에 있다고 자동 공개되지 않는다. export는 패키지 경계를 만들고 export type은 실행 코드 없이 타입 검사 정보만 내보낸다.
 */
export { default as ScActionButton } from "./ScActionButton.vue";
export { default as ScTextField } from "./ScTextField.vue";
export * from "./inputs";
export * from "./forms";
export * from "./patterns";
export { createScVuetify } from "./theme";
export type { ScVuetifyOptions } from "./theme";
export { uiTokens } from "./tokens";
export type { ScUiTokens } from "./tokens";
export { ScAppShell } from "./layout";
export type {
  ScAppShellNavItem,
  ScAppShellProps,
  ScAppShellEmits,
  ScAppShellSlots,
  ScAppShellLabels,
} from "./layout";
export type {
  ScActionButtonProps,
  ScActionButtonEmits,
  ScActionButtonSlots,
  ScActionButtonType,
  ScActionButtonVariant,
  ScActionButtonSize,
  ScActionButtonIntent,
  ScControlDensity,
  ScTextFieldProps,
  ScTextFieldEmits,
  ScTextFieldSlots,
  ScTextFieldType,
  ScTextFieldInputMode,
  ScHtmlAttrs,
} from "./contracts";
