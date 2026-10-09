<template>
  <div class="sc-series-story">
    <sc-series-chart v-bind="props" />
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * Controls에서 내려온 series/label/높이/문구를 공개 다중 차트에 전달하고 예제 폭만 바깥에서 정한다.
 */

/*
 * @sc/ui/charts의 ScSeriesChartProps 계약을 그대로 받는 표시 wrapper다. 계산/서버 자료를 추가하지 않으므로 로컬 ref나 watch가 필요 없다.
 */
import { ScSeriesChart, type ScSeriesChartProps } from "@sc/ui/charts";

const props = defineProps<ScSeriesChartProps>();
</script>
<style scoped lang="scss">
.sc-series-story {
  min-width: 0;
  max-width: 860px;
  padding: var(--sc-space-4);
  background: var(--sc-color-surface);
  border-radius: var(--sc-radius-md);
  box-shadow: var(--sc-shadow-card);
}
</style>
