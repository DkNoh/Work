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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 여러 선을 한 그래프에 그리고 하단 details 표에 모든 범주·series 값을 나란히 보여 준다.
 * 가로로 긴 표는 키보드 포커스가 가능한 scroll region 안에 있어 마우스 없이도 데이터를 확인할 수 있다.
 */

/*
 * 서로 같은 범주를 가진 최대 여섯 series를 읽기 전용으로 표시한다. 업무 집계/기간 선택은 부모가 결정한다.
 *  computed는 첫 series에서 범주를 만들고 모든 series의 길이/이름/수치가 맞는지 검사한다. 오류일 때 잘못 정렬된 선을 그리지 않는다.
 */
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
// 이름 중복·빈 이름·1,000개 초과·범주 순서 불일치·NaN/Infinity를 거절한다. 같은 x축을 비교하는 데 필요한 표시 계약이다.
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
// 부모 자료를 ECharts 옵션으로 변환한다. animation=false로 자료 교체 시 움직임을 없애며 tooltip은 HTML 문자열 대신 richText를 쓴다.
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
  // 각 series의 색은 6자리 hex만 허용한다. 지정되지 않은 경우 공통 차트 팔레트를 순서대로 사용한다.
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
