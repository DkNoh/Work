<template>
  <figure
    v-bind="containerAttrs()"
    class="sc-chart"
    :aria-labelledby="`${chartId}-title`"
    :aria-describedby="summary ? `${chartId}-summary` : undefined"
    :aria-busy="loading || undefined"
  >
    <figcaption :id="`${chartId}-title`" class="sc-chart__title">{{ label }}</figcaption>
    <p v-if="summary" :id="`${chartId}-summary`" class="sc-chart__summary">{{ summary }}</p>
    <p v-if="loading" role="status">{{ loadingLabel }}</p>
    <div v-else-if="visibleError" class="sc-chart__error" role="alert">
      <p>{{ visibleError }}</p>
      <sc-action-button @click="emit('retry')">{{ retryLabel }}</sc-action-button>
    </div>
    <p v-else-if="!visibleData.length" role="status">{{ emptyLabel }}</p>
    <div v-else class="sc-chart__plot" :style="{ height: `${plotHeight}px` }" aria-hidden="true">
      <v-chart
        :option="chartOption"
        :init-options="{ renderer: 'svg' }"
        :autoresize="true"
        @click="selectDatum"
      />
    </div>
    <details v-if="visibleData.length && validData" class="sc-chart__table">
      <summary>{{ dataTitle }}</summary>
      <table>
        <caption>{{ label }} — {{ dataTitle }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ categoryLabel }}</th>
            <th scope="col">{{ valueLabel }}</th>
            <th v-if="selectable" scope="col">{{ selectLabel }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in visibleData" :key="index">
            <th scope="row">{{ item.label }}</th>
            <td>{{ item.value }}</td>
            <td v-if="selectable">
              <sc-action-button
                :disabled="loading || !!visibleError"
                :aria-label="`${selectLabel} ${item.label}`"
                variant="text"
                @click="selectIndex(index)"
              >
                {{ selectLabel }}
              </sc-action-button>
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useAttrs, useId } from "vue";
import { use } from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import VChart from "vue-echarts";
import ScActionButton from "../ScActionButton.vue";
import { pickScHtmlAttrs } from "../contracts";
import { createChartOption, hasValidChartData } from "./chart-model";
import type { ScChartProps, ScChartEmits, ScChartSlots } from "./contracts";

use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, SVGRenderer]);
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScChartProps>(), {
  type: "bar",
  summary: "",
  height: 320,
  loading: false,
  error: "",
  emptyLabel: "표시할 데이터가 없습니다.",
  dataTitle: "차트 데이터",
  categoryLabel: "항목",
  valueLabel: "값",
  loadingLabel: "불러오는 중",
  retryLabel: "다시 시도",
  invalidDataLabel: "차트 자료의 형식이 올바르지 않습니다.",
  selectable: false,
  selectLabel: "선택",
});
const emit = defineEmits<ScChartEmits>();
defineSlots<ScChartSlots>();
const attrs = useAttrs();
const chartId = `sc-chart-${useId()}`;
const reducedMotion = ref(false);
let motionQuery: MediaQueryList | undefined;
const validData = computed(() => hasValidChartData(props.data));
const visibleData = computed(() => (validData.value ? props.data : []));
const visibleError = computed(
  () => props.error || (!validData.value ? props.invalidDataLabel : ""),
);
const plotHeight = computed(() =>
  Number.isFinite(props.height) ? Math.max(160, props.height) : 320,
);
const chartOption = computed(() =>
  createChartOption(visibleData.value, props.type, props.label, reducedMotion.value),
);
function containerAttrs() {
  return pickScHtmlAttrs(attrs, {
    omit: ["role", "aria-labelledby", "aria-describedby", "aria-busy"],
  });
}
function updateMotion(event: MediaQueryListEvent) {
  reducedMotion.value = event.matches;
}
onMounted(() => {
  if (typeof window.matchMedia !== "function") return;
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion.value = motionQuery.matches;
  motionQuery.addEventListener("change", updateMotion);
});
onBeforeUnmount(() => motionQuery?.removeEventListener("change", updateMotion));
function selectDatum(event: unknown) {
  if (
    !props.selectable ||
    props.loading ||
    visibleError.value ||
    !event ||
    typeof event !== "object" ||
    !("dataIndex" in event)
  )
    return;
  const index = event.dataIndex;
  if (typeof index !== "number" || !Number.isInteger(index)) return;
  selectIndex(index);
}
function selectIndex(index: number) {
  if (!props.selectable || props.loading || visibleError.value) return;
  const item = visibleData.value[index];
  if (item) emit("select", { label: item.label, value: item.value, index });
}
</script>

<style scoped lang="scss">
.sc-chart {
  margin: 0;
  min-width: 0;
}
.sc-chart__title {
  color: var(--sc-color-text);
  font-weight: 600;
}
.sc-chart__summary {
  color: var(--sc-color-text-muted);
  margin-block: var(--sc-space-2) var(--sc-space-4);
}
.sc-chart__plot {
  width: 100%;
  min-width: 0;
}
.sc-chart__table {
  margin-top: var(--sc-space-4);
}
.sc-chart__table summary {
  cursor: pointer;
  width: fit-content;
}
.sc-chart__table table {
  border-collapse: collapse;
  width: 100%;
  margin-top: var(--sc-space-2);
}
.sc-chart__table th,
.sc-chart__table td {
  padding: var(--sc-space-2) var(--sc-space-3);
  border-bottom: 1px solid var(--sc-color-border);
  text-align: left;
}
.sc-chart__error {
  color: var(--sc-color-error);
}
</style>
