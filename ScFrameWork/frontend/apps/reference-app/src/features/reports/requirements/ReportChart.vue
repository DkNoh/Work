<template>
  <sc-chart
    :data="chartData"
    :label="t('report.chart')"
    :summary="t('report.chartHint')"
    :loading="loading"
    :error="error"
    :loading-label="t('common.states.loading')"
    :empty-label="t('common.states.empty')"
    :retry-label="t('report.refresh')"
    :data-title="t('report.chartTable')"
    :category-label="t('report.field.status')"
    :value-label="t('report.totalLabel')"
    @retry="emit('retry')"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ScChart } from "@sc/ui/charts";
import type { RequirementReportPage } from "./api";
import { reportStatuses } from "./filters";

const props = defineProps<{
  page: RequirementReportPage | null;
  loading: boolean;
  error: string;
}>();
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n({ useScope: "global" });
// 집계는 서버가 같은 권한/전체 조건으로 계산한다. 현재 페이지 items의 개수로 대체하지 않는다.
const chartData = computed(() =>
  props.page
    ? reportStatuses.map((status) => ({
        label: t(`request.statuses.${status}`),
        value: props.page!.stats[status],
      }))
    : [],
);
</script>
