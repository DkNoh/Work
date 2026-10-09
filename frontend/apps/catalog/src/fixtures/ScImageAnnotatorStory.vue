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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 공개 이미지 주석 UI와 저장할 정규화 박스 JSON을 표시한다. 표시 전환은 canvas 컴포넌트의 mount/unmount를 재현한다.
 */

/*
 * 운영 이미지 없이 canvas로 만든 합성 PNG를 decode해 공통 UI에 넘긴다. HTMLImageElement는 깊은 반응성 변환이 필요 없어 shallowRef에 저장한다.
 *  box는 부모 역할의 ref이며 emit으로 받은 새 좌표만 교체한다. 기존 annotations와 selected ID도 이 fixture의 합성 자료다.
 */
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
// canvas/Image 같은 DOM 객체는 mount 후 준비한다. decode가 끝날 때 Story가 이미 해제됐을 수 있어 active를 검사한 뒤 반영한다.
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
// 늦게 완료한 decode가 사라진 화면 상태를 바꾸지 않게 한다. data URL 예제이므로 revoke할 Object URL은 생성하지 않는다.
onBeforeUnmount(() => {
  active = false;
});
</script>
