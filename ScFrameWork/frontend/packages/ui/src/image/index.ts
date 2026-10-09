/*
 * @sc/ui/image 진입점: 주석 UI와 정규화 좌표 계약/validator를 공개한다. canvas 픽셀 변환이나 다운로드 구현은 외부 API로 노출하지 않는다.
 * Java package와 달리 폴더 안에 있다고 자동 공개되지 않는다. export는 패키지 경계를 만들고 export type은 실행 코드 없이 타입 검사 정보만 내보낸다.
 */
export { default as ScImageAnnotator } from "./ScImageAnnotator.vue";
export type {
  ScNormalizedBox,
  ScImageAnnotation,
  ScImageLabels,
  ScImageAnnotatorProps,
  ScImageAnnotatorEmits,
  ScImageAnnotatorSlots,
} from "./contracts";
export { isNormalizedBox } from "./coordinates";
