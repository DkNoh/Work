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
const stageConfig = computed(() => {
  const width =
    Math.max(1, Math.min(hostWidth.value, props.image?.naturalWidth || 480)) * zoom.value;
  return {
    width,
    height: width * ((props.image?.naturalHeight || 320) / (props.image?.naturalWidth || 480)),
  };
});
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
function point() {
  const position = stage.value?.getNode().getPointerPosition();
  return position
    ? {
        x: Math.max(0, Math.min(1, position.x / stageConfig.value.width)),
        y: Math.max(0, Math.min(1, position.y / stageConfig.value.height)),
      }
    : null;
}
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
onMounted(() => {
  if (host.value) {
    hostWidth.value = host.value.clientWidth || 480;
    observer = new ResizeObserver(() => {
      hostWidth.value = host.value?.clientWidth || 480;
    });
    observer.observe(host.value);
  }
});
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
