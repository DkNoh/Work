<template>
  <div class="sc-series-story">
    <sc-series-chart v-bind="props" />
  </div>
</template>
<script setup lang="ts">
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
