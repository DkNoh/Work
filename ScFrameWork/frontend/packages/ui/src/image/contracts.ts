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
