<template>
  <figure v-bind="pickScHtmlAttrs(attrs)" class="sc-series-chart" :aria-labelledby="titleId">
    <figcaption :id="titleId" class="sc-series-chart__caption">{{ label }}</figcaption>
    <p v-if="!valid" role="alert">{{ invalidLabel }}</p>
    <p v-else-if="!categories.length" role="status">{{ emptyLabel }}</p>
    <template v-else>
      <div class="sc-series-chart__plot" :style="{ height: plotHeight + 'px' }" aria-hidden="true">
        <v-chart :option="option" :init-options="{ renderer: 'svg' }" autoresize />
      </div>
      <details class="sc-series-chart__data">
        <summary>{{ dataLabel }}</summary>
        <div class="sc-series-chart__scroll" tabindex="0" role="region" :aria-label="dataLabel">
          <table>
            <caption>{{ label }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ categoryLabel }}</th>
                <th v-for="line in series" :key="line.name" scope="col">{{ line.name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(category, index) in categories" :key="index">
                <th scope="row">{{ category }}</th>
                <td v-for="line in series" :key="line.name">{{ line.data[index]?.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </figure>
</template>

<script setup lang="ts">
import { computed, useAttrs, useId } from "vue";
import { use } from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import VChart from "vue-echarts";
import { pickScHtmlAttrs } from "../contracts";
import { uiTokens } from "../tokens";
import type { ScSeriesChartProps, ScSeriesChartSlots } from "./contracts";
use([LineChart, GridComponent, LegendComponent, TooltipComponent, SVGRenderer]);
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScSeriesChartProps>(), {
  height: 320,
  dataLabel: "차트 데이터 보기",
  categoryLabel: "기간",
  emptyLabel: "표시할 데이터가 없습니다.",
  invalidLabel: "차트 자료의 형식이 올바르지 않습니다.",
});
defineSlots<ScSeriesChartSlots>();
const attrs = useAttrs();
const titleId = "sc-series-" + useId();
const categories = computed(() => props.series[0]?.data.map((item) => item.label) ?? []);
const valid = computed(
  () =>
    props.series.length <= 6 &&
    new Set(props.series.map((line) => line.name)).size === props.series.length &&
    props.series.every((line) => typeof line.name === "string" && line.name.trim().length > 0) &&
    props.series.every(
      (line) =>
        line.data.length <= 1000 &&
        line.data.length === categories.value.length &&
        line.data.every(
          (item, index) =>
            typeof item.label === "string" &&
            item.label === categories.value[index] &&
            Number.isFinite(item.value),
        ),
    ),
);
const plotHeight = computed(() =>
  Number.isFinite(props.height) ? Math.max(160, props.height) : 320,
);
const colors = ["#7f67ff", "#03b562", "#fd4963", "#ffb51b", "#21b6d7", "#3b497e"];
const option = computed(() => ({
  animation: false,
  textStyle: { fontFamily: uiTokens.fontFamily, fontSize: 11, color: uiTokens.color.textMuted },
  legend: {
    top: 8,
    icon: "circle",
    itemWidth: 8,
    itemHeight: 8,
    textStyle: { fontSize: 12, color: uiTokens.color.text },
  },
  tooltip: { trigger: "axis", renderMode: "richText", confine: true },
  grid: { top: 58, left: 34, right: 10, bottom: 30 },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: categories.value,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: uiTokens.color.textMuted, margin: 14 },
  },
  yAxis: {
    type: "value",
    splitNumber: 5,
    axisLabel: { color: uiTokens.color.textMuted },
    splitLine: { lineStyle: { color: uiTokens.color.border, type: "dashed" } },
  },
  series: props.series.map((line, index) => ({
    name: line.name,
    type: "line",
    smooth: 0.2,
    showSymbol: false,
    data: line.data.map((item) => item.value),
    itemStyle: {
      color: line.color && /^#[a-f\d]{6}$/i.test(line.color) ? line.color : colors[index],
    },
    lineStyle: { width: 2 },
    areaStyle: { opacity: index === 0 ? 0.09 : 0.02 },
  })),
}));
</script>

<style scoped lang="scss">
.sc-series-chart {
  margin: 0;
  min-width: 0;
}
.sc-series-chart__caption {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.sc-series-chart__plot {
  width: 100%;
}
.sc-series-chart__data {
  margin-top: 4px;
  color: var(--sc-color-text-muted);
  font-size: 12px;
}
summary {
  width: fit-content;
  cursor: pointer;
}
.sc-series-chart__scroll {
  max-width: 100%;
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
}
th,
td {
  padding: 8px;
  border-bottom: 1px solid var(--sc-color-border);
}
caption {
  text-align: start;
  padding: 8px;
}
</style>
