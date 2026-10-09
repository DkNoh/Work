<template>
  <div class="sc-kpi-story" :class="{ 'sc-kpi-story--gallery': gallery }">
    <template v-if="gallery">
      <sc-kpi-card
        v-for="sample in samples"
        :key="sample.label"
        v-bind="sample"
        :density="card.density"
      />
    </template>
    <sc-kpi-card v-else v-bind="card" />
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 단일 Controls 카드 또는 4색 gallery를 표시한다. gallery에서는 개별 예제 tone을 유지하고 card.density만 네 카드에 함께 적용한다.
 */

/*
 * 업무 집계 없이 고정 합성 문구/값을 공개 ScKpiCardProps로 전달하는 예제다. readonly samples는 fixture가 원본 배열을 편집하지 않겠다는 타입 계약이다.
 *  card/gallery는 Story에서 내려온 입력이며 공통 KPI 내부 상태를 직접 건드리지 않는다.
 */
import { ScKpiCard, type ScKpiCardProps } from "@sc/ui";

withDefaults(defineProps<{ card: ScKpiCardProps; gallery?: boolean }>(), { gallery: false });
const samples: readonly ScKpiCardProps[] = [
  {
    label: "처리한 요청",
    value: "1,248",
    trend: "2.5% 증가",
    trendDirection: "up",
    note: "이번 달",
    tone: "green",
    iconPath: "M5 3h14v18H5V3m2 2v14h10V5H7m2 3h6v2H9V8m0 4h6v2H9v-2m0 4h4v1H9v-1",
  },
  {
    label: "검토 중",
    value: "42",
    trend: "1.5% 증가",
    trendDirection: "up",
    note: "이번 달",
    tone: "violet",
    iconPath:
      "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16m-1 3h2v5l3 2-1 2-4-3V7",
  },
  {
    label: "보완이 필요한 요청",
    value: "18",
    trend: "3.4% 감소",
    trendDirection: "down",
    note: "이번 달",
    tone: "pink",
    iconPath: "M5 3h14v18H5V3m2 2v14h10V5H7m4 2h2v7h-2V7m0 9h2v2h-2v-2",
  },
  {
    label: "참여한 구성원",
    value: "352",
    trend: "지난달과 동일",
    trendDirection: "neutral",
    note: "이번 달",
    tone: "amber",
    iconPath:
      "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4m0 8c-5 0-8 3-8 6v2h16v-2c0-3-3-6-8-6m0 2c4 0 6 2 6 4H6c0-2 2-4 6-4",
  },
];
</script>
<style scoped lang="scss">
@use "@sc/ui/tokens" with (
  $sc-emit-css: false
);
.sc-kpi-story {
  max-width: 300px;
}
.sc-kpi-story--gallery {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sc-space-6);
  max-width: none;
}
@media (max-width: #{tokens.$sc-breakpoint-sm - 1px}) {
  .sc-kpi-story--gallery {
    grid-template-columns: 1fr;
  }
}
</style>
