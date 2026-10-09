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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * v-model로 편집 영역과 선택 주석 ID를 연결하고, annotations는 읽기 전용 참조 영역으로 전달한다.
 */

/**
 * 공통 이미지 영역 편집기의 입력/이벤트 계약을 보여주는 로컬 예제다. 네트워크 대신 canvas로 만든 중립 이미지를 사용한다.
 * HTMLImageElement는 shallowRef로 보관해 DOM 객체 내부를 반응형 Proxy로 감싸지 않는다. box는 0~1 정규화 상대 좌표다.
 * onMounted에서 브라우저 이미지를 만들고 decode 완료 후 전달한다. 화면 종료 뒤 완료된 Promise는 active 검사로 버린다.
 */

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
/**
 * DOM을 사용할 수 있는 mount 이후에 canvas와 Image를 생성한다. decode Promise가 완료되어야 이미지 치수/렌더링 자료가 준비된다.
 */
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
