<template>
  <section class="sc-stack">
    <sc-action-button @click="visible = !visible">주석 표시 전환</sc-action-button>
    <sc-image-annotator
      v-if="visible"
      v-bind="props"
      :model-value="box"
      :image="props.image ?? image"
      :image-description="props.imageDescription ?? '실제 PNG 예제'"
      :annotations="props.annotations ?? annotations"
      :selected-annotation-id="selected"
      @select-annotation="selected = $event"
      @update:model-value="changeBox"
    />
    <output role="status" aria-label="저장할 좌표">
      {{ box ? JSON.stringify(box) : "박스 없음" }}
    </output>
  </section>
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { ScActionButton } from "@sc/ui";
import { ScImageAnnotator, type ScImageAnnotatorProps, type ScNormalizedBox } from "@sc/ui/image";
const props = defineProps<Partial<ScImageAnnotatorProps>>();
const emit = defineEmits<{ "update:modelValue": [box: ScNormalizedBox | null] }>();
const box = ref<ScNormalizedBox | null>(props.modelValue ?? null);
const image = shallowRef<HTMLImageElement | null>(null);
const visible = ref(true);
const selected = ref<string | null>(null);
let active = true;
const annotations = [
  { id: "old", label: "기존 주석 1", box: { x: 0.65, y: 0.65, width: 0.2, height: 0.2 } },
];
watch(
  () => props.modelValue,
  (value) => {
    box.value = value ?? null;
  },
);
function changeBox(value: ScNormalizedBox | null) {
  box.value = value;
  emit("update:modelValue", value);
}
onMounted(async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 360;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#eef3f5";
  ctx.fillRect(0, 0, 600, 360);
  ctx.fillStyle = "#21647a";
  ctx.fillRect(90, 70, 300, 180);
  const decoded = new Image();
  decoded.src = canvas.toDataURL("image/png");
  await decoded.decode();
  if (active) image.value = decoded;
});
onBeforeUnmount(() => {
  active = false;
});
</script>
