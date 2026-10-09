/*
 * @sc/ui 기본 진입점으로 합쳐지는 Select/Checkbox/TextArea export다. 내부 접근성 helper 대신 각 입력의 모델·이벤트·표현 계약을 공개한다.
 * Java package와 달리 폴더 안에 있다고 자동 공개되지 않는다. export는 패키지 경계를 만들고 export type은 실행 코드 없이 타입 검사 정보만 내보낸다.
 */
export { default as ScSelect } from "./ScSelect.vue";
export { default as ScCheckbox } from "./ScCheckbox.vue";
export { default as ScTextArea } from "./ScTextArea.vue";
export type {
  ScInputPresentationProps,
  ScInputFocusEmits,
  ScSelectOption,
  ScSelectProps,
  ScSelectEmits,
  ScSelectSlots,
  ScCheckboxProps,
  ScCheckboxEmits,
  ScCheckboxSlots,
  ScTextAreaProps,
  ScTextAreaEmits,
  ScTextAreaSlots,
} from "./input-contracts";
