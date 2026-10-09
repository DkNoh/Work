<template>
  <sc-section-card :title="english ? 'Image annotation' : '이미지 주석'">
    <sc-image-annotator
      v-model="box"
      :image="image"
      :image-description="english ? 'Blue sample diagram' : '파란색 예제 도형'"
      :annotations="annotations"
      :selected-annotation-id="selected"
      :labels="english ? englishImageLabels : undefined"
      @select-annotation="selected = $event"
    />
    <p>
      <output aria-label="Normalized box">{{ box ? JSON.stringify(box) : "—" }}</output>
    </p>
  </sc-section-card>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ScSectionCard } from "@sc/ui";
import { ScImageAnnotator, type ScNormalizedBox } from "@sc/ui/image";
import { englishImageLabels } from "./board-image-labels";
const { locale } = useI18n({ useScope: "global" });
const english = computed(() => locale.value === "en");
const image = shallowRef<HTMLImageElement | null>(null);
const box = ref<ScNormalizedBox | null>({ x: 0.1, y: 0.1, width: 0.3, height: 0.2 });
const selected = ref<string | null>(null);
let active = true;
const annotations = computed(() => [
  {
    id: "sample",
    label: english.value ? "Sample region" : "예제 영역",
    box: { x: 0.6, y: 0.5, width: 0.2, height: 0.2 },
  },
]);
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
