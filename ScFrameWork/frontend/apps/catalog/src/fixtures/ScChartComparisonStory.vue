<template>
  <section class="sc-stack" aria-label="서로 독립적인 차트 예제">
    <sc-chart v-bind="props" />
    <sc-chart v-bind="props" :label="`${props.label} 두 번째`" type="line" :data="secondData" />
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 같은 Controls를 사용하는 두 차트를 함께 표시하되 두 번째는 선 차트/두 배 값으로 구성한다.
 */

/*
 * computed의 map은 새로운 배열을 만들어 첫 번째 차트의 원본 data를 변경하지 않는다.
 *  공개 @sc/ui/charts 진입점만 사용해 여러 인스턴스가 서로 간섭하지 않는 소비 방식을 보여 준다.
 */
import { computed } from "vue";
import { ScChart, type ScChartProps } from "@sc/ui/charts";
const props = defineProps<ScChartProps>();
const secondData = computed(() =>
  props.data.map((datum) => ({ label: datum.label, value: datum.value * 2 })),
);
</script>
