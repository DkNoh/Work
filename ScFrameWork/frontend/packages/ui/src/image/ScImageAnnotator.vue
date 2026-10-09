<template>
  <figure v-bind="imageAttrs()" class="sc-image-annotator" @keydown.esc="cancelDrawing">
    <figcaption :id="captionId">{{ imageDescription }}</figcaption>
    <p :id="instructionsId">{{ text.instructions }}</p>
    <p v-if="loading" role="status">{{ text.loading }}</p>
    <div v-if="error" role="alert">
      <p>{{ error }}</p>
      <button type="button" :disabled="disabled" @click="emit('retry')">{{ text.retry }}</button>
    </div>
    <label :for="zoomId">{{ text.zoom }}</label>
    <input
      :id="zoomId"
      v-model.number="zoom"
      type="range"
      min="1"
      max="3"
      step="0.25"
      :disabled="!image || disabled || loading"
    />
    <output :for="zoomId">{{ zoom }}×</output>
    <div
      ref="host"
      class="sc-image-viewport"
      tabindex="0"
      role="region"
      :aria-labelledby="captionId"
      :aria-describedby="instructionsId"
    >
      <div v-if="image" role="img" :aria-label="imageDescription">
        <v-stage
          ref="stage"
          :config="stageConfig"
          @pointerdown="startDrawing"
          @pointermove="continueDrawing"
          @pointerup="finishDrawing"
          @pointercancel="cancelDrawing"
        >
          <v-layer>
            <v-image :config="{ image, width: stageConfig.width, height: stageConfig.height }" />
            <v-rect
              v-for="annotation in checkedAnnotations"
              :key="annotation.id"
              :config="annotationConfig(annotation)"
              @click="selectAnnotation(annotation.id)"
              @tap="selectAnnotation(annotation.id)"
            />
            <v-rect
              v-if="visibleBox"
              ref="rectangle"
              :config="rectangleConfig"
              @dragstart="startBoxGesture"
              @transformstart="startBoxGesture"
              @dragend="finishMove"
              @transformend="finishTransform"
            />
            <v-transformer ref="transformer" :config="transformerConfig" />
          </v-layer>
        </v-stage>
      </div>
      <p v-else>{{ text.noImage }}</p>
    </div>
    <fieldset :disabled="!editable">
      <legend>{{ text.coordinates }}</legend>
      <div class="sc-image-coordinates">
        <label
          v-for="field in coordinateFields"
          :key="field.key"
          :for="`${captionId}-${field.key}`"
        >
          {{ field.label }}
          <input
            :id="`${captionId}-${field.key}`"
            :value="draft[field.key]"
            type="number"
            min="0"
            max="1"
            step="any"
            :aria-invalid="coordinateError || undefined"
            :aria-describedby="coordinateError ? errorId : undefined"
            @input="setCoordinate(field.key, $event)"
          />
        </label>
      </div>
      <button type="button" @click="applyCoordinates">{{ text.apply }}</button>
      <button type="button" :disabled="!modelValue" @click="clearBox">{{ text.clear }}</button>
    </fieldset>
    <p v-if="coordinateError" :id="errorId" role="alert">{{ text.invalid }}</p>
    <ul
      v-if="checkedAnnotations.length"
      :aria-label="text.annotations"
      class="sc-image-annotations"
    >
      <li v-for="annotation in checkedAnnotations" :key="annotation.id">
        <button
          type="button"
          :disabled="disabled || loading"
          :aria-pressed="annotation.id === selectedAnnotationId"
          @click="selectAnnotation(annotation.id)"
        >
          {{ annotation.label }}
        </button>
        <span>
          {{ annotation.box.x }}, {{ annotation.box.y }} · {{ annotation.box.width }} ×
          {{ annotation.box.height }}
        </span>
      </li>
    </ul>
    <p role="status" aria-live="polite">{{ announcement }}</p>
  </figure>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 이미지/기존 주석/현재 박스를 canvas에 그리고 확대·좌표 입력·주석 목록을 native HTML로 함께 제공한다.
 * canvas 포인터와 좌표 적용 버튼은 같은 modelValue 변경 emit으로 연결된다. Escape는 그리기 또는 이동/크기 조절을 취소한다.
 */

/*
 * 부모가 decode한 HTMLImageElement와 정규화된 0~1 박스를 받는 주석 UI다. 파일 다운로드·Object URL·서버 저장·권한은 소비 앱 책임이다.
 *  ref는 canvas/DOM 참조·zoom·그리는 preview를, reactive draft는 사용자가 아직 적용하지 않은 좌표 문자열을 소유한다.
 *  computed는 표시 픽셀·편집 가능 상태·주석 검증을 계산한다. 공개 modelValue는 부모가 원본이며 드래그 도중 값은 preview에만 둔다.
 */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  useAttrs,
  useId,
  watch,
} from "vue";
import {
  Stage as VStage,
  Layer as VLayer,
  Image as VImage,
  Rect as VRect,
  Transformer as VTransformer,
  type VueKonvaRef,
} from "vue-konva";
import type Konva from "konva";
import { pickScHtmlAttrs } from "../contracts";
import { uiTokens } from "../tokens";
import { clampBox, drawBox, isNormalizedBox } from "./coordinates";
import type {
  ScImageAnnotatorProps,
  ScImageAnnotatorEmits,
  ScImageAnnotatorSlots,
  ScImageLabels,
  ScNormalizedBox,
  ScImageAnnotation,
} from "./contracts";
defineOptions({ inheritAttrs: false });
const props = defineProps<ScImageAnnotatorProps>();
const emit = defineEmits<ScImageAnnotatorEmits>();
defineSlots<ScImageAnnotatorSlots>();
const attrs = useAttrs();
function imageAttrs() {
  return pickScHtmlAttrs(attrs, { omit: ["role"] });
}
const captionId = `sc-image-${useId()}`;
const instructionsId = `${captionId}-instructions`;
const errorId = `${captionId}-error`;
const zoomId = `${captionId}-zoom`;
const defaults: ScImageLabels = {
  loading: "불러오는 중",
  noImage: "이미지가 없습니다.",
  retry: "다시 시도",
  coordinates: "주석 좌표",
  x: "가로 시작",
  y: "세로 시작",
  width: "너비",
  height: "높이",
  apply: "좌표 적용",
  clear: "박스 지우기",
  zoom: "확대",
  instructions:
    "이미지 위에서 드래그하여 박스를 그립니다. 좌표 입력으로도 작성·수정할 수 있습니다. Escape로 그리기를 취소합니다.",
  invalid: "좌표는 0~1 범위의 양수 크기로 이미지 안에 있어야 합니다.",
  changed: "박스 변경",
  cancelled: "그리기 취소",
  annotations: "기존 주석",
};
const text = computed(() => ({ ...defaults, ...props.labels }));
// as const로 key를 일반 string이 아닌 x/y/width/height의 리터럴 union으로 유지해 draft[key]를 타입 안전하게 읽는다.
const coordinateFields = computed(
  () =>
    [
      { key: "x", label: text.value.x },
      { key: "y", label: text.value.y },
      { key: "width", label: text.value.width },
      { key: "height", label: text.value.height },
    ] as const,
);
const host = ref<HTMLElement | null>(null);
const stage = ref<VueKonvaRef<Konva.Stage> | null>(null);
const rectangle = ref<VueKonvaRef<Konva.Rect> | null>(null);
const transformer = ref<VueKonvaRef<Konva.Transformer> | null>(null);
const hostWidth = ref(480);
const zoom = ref(1);
const preview = ref<ScNormalizedBox | null>(null);
const announcement = ref("");
const coordinateError = ref(false);
const draft = reactive({ x: "", y: "", width: "", height: "" });
const editable = computed(
  () => !!props.image && !props.readonly && !props.disabled && !props.loading,
);
// 원본 이미지 비율을 유지한 화면 크기를 계산한다. zoom/컨테이너 폭이 달라져도 저장 좌표는 0~1이므로 의미가 변하지 않는다.
const stageConfig = computed(() => {
  const width =
    Math.max(1, Math.min(hostWidth.value, props.image?.naturalWidth || 480)) * zoom.value;
  return {
    width,
    height: width * ((props.image?.naturalHeight || 320) / (props.image?.naturalWidth || 480)),
  };
});
// 기존 주석의 ID/이름/박스를 먼저 확인한다. 잘못된 좌표가 canvas의 잘못된 위치나 key 충돌로 이어지지 않게 한다.
const checkedAnnotations = computed(() => {
  const ids = new Set<string>();
  return (props.annotations ?? []).map((annotation) => {
    if (
      !annotation.id.trim() ||
      !annotation.label.trim() ||
      ids.has(annotation.id) ||
      !isNormalizedBox(annotation.box)
    )
      throw new TypeError("주석 ID·이름·좌표가 올바르지 않습니다.");
    ids.add(annotation.id);
    return annotation;
  });
});
const visibleBox = computed(() => {
  if (props.modelValue !== null && !isNormalizedBox(props.modelValue))
    throw new TypeError("박스 좌표가 올바르지 않습니다.");
  return preview.value ?? props.modelValue;
});
// 공통 정규화 좌표를 현재 stage 픽셀로 바꾸는 단방향 표시 변환이다. API나 DB에 픽셀값을 저장하지 않는다.
function pixels(box: ScNormalizedBox) {
  return {
    x: box.x * stageConfig.value.width,
    y: box.y * stageConfig.value.height,
    width: box.width * stageConfig.value.width,
    height: box.height * stageConfig.value.height,
  };
}
const rectangleConfig = computed(() => ({
  ...(visibleBox.value ? pixels(visibleBox.value) : {}),
  stroke: uiTokens.color.focus,
  strokeWidth: 2,
  fill: "rgba(23,74,97,0.08)",
  draggable: editable.value,
  name: "sc-current-box",
}));
function annotationConfig(annotation: ScImageAnnotation) {
  return {
    ...pixels(annotation.box),
    stroke:
      annotation.id === props.selectedAnnotationId
        ? uiTokens.color.focus
        : uiTokens.color.controlBorder,
    strokeWidth: 2,
    fill: "rgba(118,118,118,0.08)",
  };
}
// vendor Transformer의 회전/반전을 끄고 이미지 안의 양수 크기만 허용한다. 편집 불가이면 resize anchor도 제거한다.
const transformerConfig = computed(() => ({
  rotateEnabled: false,
  flipEnabled: false,
  ignoreStroke: true,
  resizeEnabled: editable.value,
  enabledAnchors: editable.value ? ["top-left", "top-right", "bottom-left", "bottom-right"] : [],
  boundBoxFunc: (oldBox: Konva.Box, newBox: Konva.Box) =>
    newBox.width >= 1 &&
    newBox.height >= 1 &&
    newBox.x >= 0 &&
    newBox.y >= 0 &&
    newBox.x + newBox.width <= stageConfig.value.width &&
    newBox.y + newBox.height <= stageConfig.value.height
      ? newBox
      : oldBox,
}));
// 부모 모델이 확정되면 좌표 폼 문자열을 동기화한다. 입력 중 빈 문자열을 표현해야 하므로 draft는 number가 아닌 string이다.
function copyCoordinates(box: ScNormalizedBox | null) {
  for (const key of ["x", "y", "width", "height"] as const)
    draft[key] = box ? String(box[key]) : "";
  coordinateError.value = false;
}
watch(
  () => props.modelValue,
  (box) => {
    preview.value = null;
    copyCoordinates(box);
  },
  { immediate: true },
);
// 박스 DOM node 생성은 Vue 렌더 뒤에 완료된다. nextTick을 기다려 Transformer에 현재 rect node를 연결/해제한다.
watch(
  [visibleBox, editable],
  async () => {
    await nextTick();
    const node = transformer.value?.getNode();
    node?.nodes(editable.value && rectangle.value ? [rectangle.value.getNode()] : []);
  },
  { immediate: true },
);
watch(
  () => props.image,
  () => {
    cancelDrawing();
    zoom.value = 1;
  },
);
watch(editable, (value) => {
  if (!value) cancelDrawing();
});
let origin: { x: number; y: number } | null = null;
let gestureBox: ScNormalizedBox | null = null;
let gestureCancelled = false;
let captured: { element: Element; pointerId: number } | null = null;
// stage의 포인터 픽셀을 0~1 범위로 되돌려 캔버스 크기와 무관한 그리기 좌표를 얻는다.
function point() {
  const position = stage.value?.getNode().getPointerPosition();
  return position
    ? {
        x: Math.max(0, Math.min(1, position.x / stageConfig.value.width)),
        y: Math.max(0, Math.min(1, position.y / stageConfig.value.height)),
      }
    : null;
}
// 배경 Stage/Image에서 시작한 편집만 새 박스로 처리한다. pointer capture는 이미지 밖으로 움직여도 동일 제스처의 종료를 받게 한다.
function startDrawing(event: Konva.KonvaEventObject<PointerEvent>) {
  if (!editable.value || !["Stage", "Image"].includes(event.target.getClassName())) return;
  origin = point();
  preview.value = null;
  const target = event.evt.target;
  if (event.evt.isTrusted && target instanceof Element && "setPointerCapture" in target) {
    target.setPointerCapture(event.evt.pointerId);
    captured = { element: target, pointerId: event.evt.pointerId };
  }
}
function continueDrawing() {
  const end = point();
  if (origin && end) preview.value = drawBox(origin, end);
}
// 완료/취소/unmount에서 capture를 해제한다. 다음 화면의 포인터 동작이 이전 canvas에 묶이지 않게 하는 수명 정리다.
function releaseCapture() {
  if (
    captured &&
    "hasPointerCapture" in captured.element &&
    captured.element.hasPointerCapture(captured.pointerId)
  )
    captured.element.releasePointerCapture(captured.pointerId);
  captured = null;
}
function finishDrawing() {
  if (!origin) return;
  continueDrawing();
  const value = preview.value;
  origin = null;
  releaseCapture();
  if (value && editable.value) commit(value);
  preview.value = null;
}
// 취소는 미리보기 제거뿐 아니라 vendor가 제자리 변경한 rect 위치/scale도 시작 전 값으로 복구한다. 이어 오는 종료 이벤트의 재저장은 플래그로 막는다.
function cancelDrawing() {
  if (origin || gestureBox) announcement.value = text.value.cancelled;
  if (gestureBox) {
    gestureCancelled = true;
    const previous = gestureBox;
    gestureBox = null;
    const node = rectangle.value?.getNode();
    node?.stopDrag();
    transformer.value?.getNode().stopTransform();
    node?.scale({ x: 1, y: 1 });
    node?.setAttrs(pixels(previous));
  }
  origin = null;
  preview.value = null;
  releaseCapture();
}
function startBoxGesture() {
  gestureCancelled = false;
  gestureBox = props.modelValue ? { ...props.modelValue } : null;
}
// 포인터·이동·resize·숫자 입력의 최종 공통 출구다. 검증된 새 박스만 부모에 요청하며 서버 저장을 직접 하지 않는다.
function commit(box: ScNormalizedBox) {
  if (!editable.value || !isNormalizedBox(box)) return;
  coordinateError.value = false;
  announcement.value = text.value.changed;
  emit("update:modelValue", box);
}
function finishMove(event: Konva.KonvaEventObject<DragEvent>) {
  if (gestureCancelled) {
    gestureCancelled = false;
    return;
  }
  if (!visibleBox.value || !editable.value) return;
  const node = event.target;
  const box = clampBox({
    ...visibleBox.value,
    x: node.x() / stageConfig.value.width,
    y: node.y() / stageConfig.value.height,
  });
  gestureBox = null;
  node.position({ x: box.x * stageConfig.value.width, y: box.y * stageConfig.value.height });
  commit(box);
}
// Konva resize는 width 자체 대신 scale을 바꿀 수 있다. 실제 크기로 환산한 뒤 scale을 1로 정리해 다음 편집에서 중복 확대를 막는다.
function finishTransform() {
  if (gestureCancelled) {
    gestureCancelled = false;
    return;
  }
  const node = rectangle.value?.getNode();
  if (!node || !editable.value) return;
  const box = clampBox({
    x: node.x() / stageConfig.value.width,
    y: node.y() / stageConfig.value.height,
    width: (node.width() * node.scaleX()) / stageConfig.value.width,
    height: (node.height() * node.scaleY()) / stageConfig.value.height,
  });
  node.scale({ x: 1, y: 1 });
  node.setAttrs(pixels(box));
  gestureBox = null;
  commit(box);
}
// Number(빈 문자열)가 0이 되는 JS 특성이 있으므로 빈 입력을 별도로 검사한다. 유효하지 않으면 모델은 그대로 두고 오류만 표시한다.
function applyCoordinates() {
  if (!editable.value) return;
  const box = {
    x: Number(draft.x),
    y: Number(draft.y),
    width: Number(draft.width),
    height: Number(draft.height),
  };
  if (Object.values(draft).some((value) => !value.trim()) || !isNormalizedBox(box)) {
    coordinateError.value = true;
    return;
  }
  commit(box);
}
// keyof typeof draft는 이미 선언된 좌표 필드 이름만 허용한다. instanceof로 실제 input을 확인한 뒤 원문 문자열을 보관한다.
function setCoordinate(key: keyof typeof draft, event: Event) {
  if (!editable.value) return;
  const input = event.target;
  if (input instanceof HTMLInputElement) draft[key] = input.value;
}
function clearBox() {
  if (editable.value) {
    cancelDrawing();
    emit("update:modelValue", null);
  }
}
function selectAnnotation(id: string) {
  if (!props.disabled && !props.loading) emit("select-annotation", id);
}
let observer: ResizeObserver | null = null;
// ResizeObserver는 실제 DOM이 생긴 후 연결한다. 화면 폭 변화는 stage 크기 계산의 입력만 갱신한다.
onMounted(() => {
  if (host.value) {
    hostWidth.value = host.value.clientWidth || 480;
    observer = new ResizeObserver(() => {
      hostWidth.value = host.value?.clientWidth || 480;
    });
    observer.observe(host.value);
  }
});
// 직접 등록한 Observer/capture와 Transformer node 연결을 화면 수명에 맞춰 해제한다.
onBeforeUnmount(() => {
  releaseCapture();
  observer?.disconnect();
  transformer.value?.getNode().nodes([]);
});
</script>
<style scoped>
.sc-image-annotator {
  margin: 0;
  min-width: 0;
}
figcaption {
  font-weight: 700;
}
.sc-image-viewport {
  max-width: 100%;
  overflow: auto;
  max-height: 640px;
  border: 1px solid var(--sc-color-control-border);
  margin: var(--sc-space-3) 0;
}
.sc-image-viewport:focus-visible,
input:focus-visible,
button:focus-visible {
  outline: 2px solid var(--sc-color-focus);
  outline-offset: 2px;
}
fieldset {
  min-width: 0;
  padding: var(--sc-space-3);
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
}
.sc-image-coordinates {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--sc-space-3);
  margin-bottom: var(--sc-space-3);
}
.sc-image-coordinates label {
  display: grid;
  gap: var(--sc-space-1);
}
input,
button {
  min-width: 0;
  color: var(--sc-color-text);
  background: var(--sc-color-surface);
  border: 1px solid var(--sc-color-control-border);
  border-radius: var(--sc-radius-sm);
  min-height: 32px;
  padding: var(--sc-space-1) var(--sc-space-2);
}
button {
  margin-inline-end: var(--sc-space-2);
}
.sc-image-annotations {
  padding-inline-start: var(--sc-space-5);
}
.sc-image-annotations li {
  margin: var(--sc-space-2) 0;
}
</style>
