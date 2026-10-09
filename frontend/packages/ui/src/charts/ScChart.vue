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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 제목/설명 다음에 로딩·오류·빈 상태·실제 차트를 분기한다. 그래픽은 장식 영역이고 같은 데이터의 native 표를 details에 제공한다.
 * selectable이면 그래픽 클릭과 표의 선택 버튼이 같은 select 이벤트로 이어져 키보드로도 같은 기능을 쓸 수 있다.
 */

/*
 * 부모가 집계한 label/value 배열을 표시하는 막대/선 차트다. ECharts 옵션은 내부 helper가 만들고 공통 API에는 vendor 객체를 노출하지 않는다.
 *  computed로 검증 결과·표시 데이터·오류·높이·옵션을 유도한다. 로컬 ref는 OS의 reduced-motion 설정뿐이며 서버 자료를 복제하지 않는다.
 */
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

// ECharts에서 필요한 차트/기능/SVG renderer만 등록한다. 전체 차트 라이브러리 설정을 앱마다 반복하지 않게 한다.
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
// TypeScript 타입은 외부 실행 중 자료를 검증하지 않는다. 유한한 숫자인지 확인한 뒤 그래픽과 대체 표에 같은 자료를 사용한다.
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
// window.matchMedia는 DOM 환경의 부수 효과다. mount 후 현재 모션 설정을 읽고 변경을 구독하며 아래 unmount에서 listener를 해제한다.
onMounted(() => {
  if (typeof window.matchMedia !== "function") return;
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion.value = motionQuery.matches;
  motionQuery.addEventListener("change", updateMotion);
});
onBeforeUnmount(() => motionQuery?.removeEventListener("change", updateMotion));
// vendor 이벤트는 unknown으로 받아 실제 객체/dataIndex 정수를 검사한다. 타입 단언만으로 신뢰하지 않는다.
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
// 그래픽/표 선택의 공통 출구다. 로딩·오류 중 선택을 막고 앱에 중립 데이터만 전달한다.
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
