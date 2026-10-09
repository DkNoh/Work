/*
 * 이미지 주석 부품의 입력/출력 계약이다. ScNormalizedBox는 원본 이미지에 대한 0~1 상대 좌표로 확대/화면 폭과 무관하다.
 *  HTMLImageElement는 소비 앱에서 로딩/해석한 객체다. 이 UI가 이미지 URL 인증이나 다운로드를 맡지 않게 입력 책임을 분리한다.
 *  modelValue=null은 현재 박스 없음, update:modelValue는 새 좌표/삭제 의도, select-annotation은 기존 주석 선택 ID만 전달한다.
 */
export interface ScNormalizedBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface ScImageAnnotation {
  readonly id: string;
  readonly label: string;
  readonly box: ScNormalizedBox;
}
export interface ScImageLabels {
  loading: string;
  noImage: string;
  retry: string;
  coordinates: string;
  x: string;
  y: string;
  width: string;
  height: string;
  apply: string;
  clear: string;
  zoom: string;
  instructions: string;
  invalid: string;
  changed: string;
  cancelled: string;
  annotations: string;
}
export interface ScImageAnnotatorProps {
  image: HTMLImageElement | null;
  imageDescription: string;
  modelValue: ScNormalizedBox | null;
  annotations?: readonly ScImageAnnotation[];
  selectedAnnotationId?: string | null;
  readonly?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  labels?: Partial<ScImageLabels>;
}
export interface ScImageAnnotatorEmits {
  "update:modelValue": [box: ScNormalizedBox | null];
  "select-annotation": [id: string];
  retry: [];
}
export type ScImageAnnotatorSlots = Record<string, never>;
