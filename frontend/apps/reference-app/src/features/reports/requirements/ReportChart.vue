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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 로딩/오류/자료 유무에 맞는 상태를 표시하고, 공통 차트에는 번역한 상태 이름과 서버 집계 숫자를 전달한다.
 */

/**
 * 현재 조회 조건 전체의 업무 상태 집계를 차트로 변환하는 표시 컴포넌트다. 서버 응답 page.stats가 집계의 원본이다.
 * props.page의 현재 행 items만 세면 페이지 크기만큼의 값으로 축소되므로 사용하지 않는다. computed는 언어/응답 변경을 표시 자료에 반영한다.
 * 오류 재시도 버튼은 retry 이벤트만 보낸다. 실제 Query refetch는 부모 보고서 화면에서 실행한다.
 */

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
