<template>
  <section class="sc-stack" aria-label="차트 중립 예제">
    <div class="sc-inline">
      <sc-action-button @click="changeData">자료 변경</sc-action-button>
      <sc-action-button @click="changeType">선/막대 전환</sc-action-button>
      <sc-action-button @click="resizeChart">폭 변경</sc-action-button>
      <sc-action-button @click="visible = !visible">표시 전환</sc-action-button>
    </div>
    <div :style="{ width: `${width}px`, maxWidth: '100%' }">
      <sc-chart
        v-if="visible"
        v-bind="props"
        :data="data"
        :type="type"
        @select="selected = `${$event.label}: ${$event.value}`"
        @retry="retryCount += 1"
      />
    </div>
    <p role="status" aria-label="차트 선택">{{ selected || "선택 없음" }}</p>
    <p role="status" aria-label="차트 재시도">{{ retryCount }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ScActionButton } from "@sc/ui";
import { ScChart, type ScChartProps, type ScChartType } from "@sc/ui/charts";
const props = defineProps<ScChartProps>();
const data = ref(props.data);
const type = ref<ScChartType>(props.type ?? "bar");
const width = ref(600);
const visible = ref(true);
const selected = ref("");
const retryCount = ref(0);
watch(
  () => props.data,
  (value) => {
    data.value = value;
  },
);
watch(
  () => props.type,
  (value) => {
    type.value = value ?? "bar";
  },
);
function changeData() {
  data.value = [
    { label: "갱신한 항목", value: 15 },
    { label: "둘째 항목", value: 8 },
  ];
}
function changeType() {
  type.value = type.value === "bar" ? "line" : "bar";
}
function resizeChart() {
  width.value = width.value === 600 ? 280 : 600;
}
</script>
