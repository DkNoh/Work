<template>
  <section class="sc-stack" aria-label="서로 독립적인 차트 예제">
    <sc-chart v-bind="props" />
    <sc-chart v-bind="props" :label="`${props.label} 두 번째`" type="line" :data="secondData" />
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ScChart, type ScChartProps } from "@sc/ui/charts";
const props = defineProps<ScChartProps>();
const secondData = computed(() =>
  props.data.map((datum) => ({ label: datum.label, value: datum.value * 2 })),
);
</script>
