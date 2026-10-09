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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 자료·종류·폭·mount 상태를 바꾸는 도구와 차트의 select/retry 결과를 표시한다.
 */

/*
 * data/type ref는 Story 안에서 조작할 예제 상태다. Controls가 props를 바꾸면 watch로 다시 동기화한다.
 *  visible의 v-if 전환은 차트 생성/정리 경계를 확인하고 width 변경은 autoresize 동작을 확인한다. 실제 집계/API는 포함하지 않는다.
 */
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
// 고정 합성 배열로 교체한다. 차트에 전달한 props 배열을 직접 수정하지 않는 소비 예제다.
function changeData() {
  data.value = [
    { label: "갱신한 항목", value: 15 },
    { label: "둘째 항목", value: 8 },
  ];
}
// ScChartType union의 두 허용 값 사이만 전환한다. 새로운 vendor 옵션을 임의로 넘기지 않는다.
function changeType() {
  type.value = type.value === "bar" ? "line" : "bar";
}
function resizeChart() {
  width.value = width.value === 600 ? 280 : 600;
}
</script>
