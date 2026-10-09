<template>
  <section class="dashboard" :aria-label="text.title">
    <header class="dashboard-heading">
      <div>
        <h1>{{ text.greeting }}, {{ runtime.session.identity?.username }}{{ isKo ? "님" : "" }}</h1>
        <p class="dashboard-data-note">
          <span class="dashboard-subtitle">{{ text.subtitle }}</span>
          <span
            class="dashboard-data-source"
            :title="mode === 'sample' ? text.sampleNote : text.liveNote"
          >
            <span class="dashboard-data-dot" />
            {{
              mode === "sample"
                ? words("샘플 데이터", "Sample data")
                : words("실제 업무 데이터", "Live workspace")
            }}
          </span>
        </p>
      </div>
      <div class="dashboard-controls">
        <sc-select
          presentation="toolbar"
          density="compact"
          :label="text.source"
          :model-value="mode"
          :options="sourceOptions"
          @update:model-value="changeMode"
        />
        <sc-select
          v-if="mode === 'sample'"
          presentation="toolbar"
          density="compact"
          tone="primary"
          :label="text.period"
          :model-value="period"
          :options="periodOptions"
          @update:model-value="changePeriod"
        />
        <sc-action-button
          size="sm"
          intent="secondary"
          icon-only
          :icon-path="mdiDownload"
          :aria-label="text.export"
          @click="exportRows"
        />
      </div>
    </header>
    <p v-if="report.error.value && mode === 'live'" role="alert" class="dashboard-error">
      {{ report.error.value.message }}
      <sc-action-button size="sm" variant="text" intent="danger" @click="report.refetch()">
        {{ text.retry }}
      </sc-action-button>
    </p>
    <div class="dashboard-layout">
      <div class="dashboard-main">
        <div class="dashboard-kpis">
          <sc-kpi-card
            v-for="card in cards"
            :key="card.label"
            density="compact"
            :label="card.label"
            :value="card.value"
            :note="card.note"
            :trend="card.trend"
            :trend-direction="card.direction"
            :tone="card.tone"
            :icon-path="card.icon"
          />
        </div>
        <div class="dashboard-chart-grid">
          <sc-section-card
            density="compact"
            surface="plain"
            class="dashboard-revenue"
            :title="mode === 'sample' ? text.revenue : text.workTrend"
          >
            <template #actions>
              <span class="dashboard-card-period">
                {{ mode === "sample" ? periodLabel : words("최근 20건", "Latest 20 items") }}
              </span>
              <sc-action-button
                size="sm"
                intent="neutral"
                variant="tonal"
                :icon-path="mdiDownload"
                :aria-label="words('차트 내보내기 CSV', 'Export chart as CSV')"
                @click="exportChart"
              >
                {{ words("내보내기", "Export") }}
              </sc-action-button>
            </template>
            <sc-series-chart
              :series="chartSeries"
              :label="mode === 'sample' ? text.revenue : text.workTrend"
              :height="322"
              :data-label="text.chartData"
              :category-label="mode === 'sample' ? text.period : text.date"
              :empty-label="text.noData"
            />
          </sc-section-card>
          <sc-section-card
            density="compact"
            surface="plain"
            class="dashboard-device"
            :title="mode === 'sample' ? text.devices : text.workStatus"
          >
            <div class="dashboard-gauge">
              <svg
                viewBox="0 0 240 145"
                role="img"
                :aria-label="text.distribution + ': ' + number(distributionTotal)"
              >
                <path
                  d="M24 120 A96 96 0 0 1 216 120"
                  fill="none"
                  stroke="#f0f2f8"
                  stroke-width="25"
                />
                <path
                  v-for="(segment, index) in distribution"
                  :key="segment.label"
                  :d="arcPath(index)"
                  fill="none"
                  :stroke="segment.color"
                  stroke-width="25"
                />
                <text x="120" y="96" text-anchor="middle" class="dashboard-gauge-label">
                  {{ mode === "sample" ? text.visitors : text.total }}
                </text>
                <text x="120" y="121" text-anchor="middle" class="dashboard-gauge-value">
                  {{ number(distributionTotal) }}
                </text>
              </svg>
            </div>
            <ul class="dashboard-distribution">
              <li v-for="segment in distribution" :key="segment.label">
                <span class="dashboard-dot" :style="{ '--dot-color': segment.color }" />
                <span>{{ segment.label }}</span>
                <small>{{ segment.percent }}%</small>
                <strong>{{ number(segment.value) }}</strong>
              </li>
            </ul>
          </sc-section-card>
        </div>
        <div v-if="mode === 'sample'" class="dashboard-small-grid">
          <sc-section-card density="compact" surface="plain" :title="text.channels">
            <template #actions>
              <router-link to="/patterns">{{ text.viewAll }} →</router-link>
            </template>
            <div class="dashboard-channel-bar">
              <span
                v-for="channel in channels"
                :key="channel.name"
                :style="{ width: channel.percent + '%', background: channel.color }"
              />
            </div>
            <p class="dashboard-channel-summary">
              {{ text.channelTotal }}
              <strong>₩84,260,000</strong>
            </p>
            <div v-for="channel in channels" :key="channel.name" class="dashboard-channel">
              <span class="dashboard-channel-icon" :style="{ color: channel.color }">
                {{ channel.initial }}
              </span>
              <div>
                <strong>{{ channel.name }}</strong>
                <div class="dashboard-progress">
                  <span :style="{ width: channel.percent + '%', background: channel.color }" />
                </div>
              </div>
              <span>{{ channel.percent }}%</span>
            </div>
          </sc-section-card>
          <sc-section-card density="compact" surface="plain" :title="text.transactions">
            <template #actions>
              <a href="#dashboard-orders">{{ text.viewAll }} →</a>
            </template>
            <div
              v-for="(transaction, index) in transactions"
              :key="transaction.label"
              class="dashboard-transaction"
            >
              <span class="dashboard-payment-icon" :class="'payment-' + index">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="mdiWalletOutline" /></svg>
              </span>
              <div>
                <strong>{{ transaction.label }}</strong>
                <small>{{ text.onlinePayment }}</small>
              </div>
              <strong>{{ transaction.value }}</strong>
            </div>
          </sc-section-card>
          <sc-section-card density="compact" surface="plain" :title="text.schedule">
            <template #actions>
              <router-link to="/kanban">{{ text.viewAll }} →</router-link>
            </template>
            <ol class="dashboard-timeline">
              <li v-for="event in events" :key="event.title">
                <time>{{ event.date }}</time>
                <div>
                  <strong>{{ event.title }}</strong>
                  <span>{{ event.tag }}</span>
                  <p>{{ event.description }}</p>
                </div>
              </li>
            </ol>
          </sc-section-card>
        </div>
        <sc-section-card
          id="dashboard-orders"
          density="compact"
          surface="plain"
          class="dashboard-orders"
          :title="mode === 'sample' ? text.orders : text.recentWork"
        >
          <template #actions>
            <router-link :to="mode === 'sample' ? '/examples' : '/requests'">
              {{ text.viewAll }} →
            </router-link>
          </template>
          <sc-data-table
            class="dashboard-order-table"
            density="compact"
            caption-visibility="sr-only"
            :min-table-width="690"
            :caption="mode === 'sample' ? text.orders : text.recentWork"
            :rows="visibleOrders"
            :columns="orderColumns"
            :get-row-key="getOrderKey"
            :loading="mode === 'live' && report.isFetching.value"
            :labels="orderTableLabels"
          >
            <template #cell="{ row, columnId, value }">
              <div v-if="columnId === 'product'" class="dashboard-product-cell">
                <span class="dashboard-product-icon" :class="'product-' + row.tone">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="row.icon" /></svg>
                </span>
                <span>
                  {{ row.title }}
                  <small>{{ row.id }}</small>
                </span>
              </div>
              <template v-else-if="columnId === 'customer'">
                <span class="dashboard-table-avatar" aria-hidden="true">
                  {{ row.customer.slice(0, 1) }}
                </span>
                {{ row.customer }}
              </template>
              <sc-status-badge
                v-else-if="columnId === 'status'"
                :label="row.status"
                :tone="row.tone === 'green' ? 'success' : row.tone === 'amber' ? 'warning' : 'info'"
              />
              <template v-else>{{ value }}</template>
            </template>
          </sc-data-table>
        </sc-section-card>
      </div>
      <aside class="dashboard-widgets" :aria-label="text.widgets">
        <section class="dashboard-promotion">
          <div>
            <h2>{{ text.promoTitle }}</h2>
            <p>{{ text.promoDescription }}</p>
            <router-link to="/patterns">{{ text.promoAction }} →</router-link>
          </div>
          <svg viewBox="0 0 140 180" aria-hidden="true" class="dashboard-promotion-art">
            <rect x="27" y="45" width="95" height="100" rx="12" fill="#fff" stroke="#a5d9c6" />
            <rect x="40" y="60" width="35" height="12" rx="4" fill="#c1eadb" />
            <rect x="40" y="86" width="14" height="42" rx="4" fill="#8cd6b6" />
            <rect x="62" y="99" width="14" height="29" rx="4" fill="#b7a8ff" />
            <rect x="84" y="80" width="14" height="48" rx="4" fill="#67c79c" />
            <path
              d="M45 39C48 9 88 8 92 37"
              fill="none"
              stroke="#718fa0"
              stroke-width="2"
              stroke-dasharray="3 4"
            />
            <circle cx="68" cy="26" r="17" fill="#d7f4e7" stroke="#7bbf9e" />
            <path
              d="M63 31h10M64 37h8M65 26v-7h6v7"
              fill="none"
              stroke="#087d47"
              stroke-width="2"
            />
            <circle cx="112" cy="143" r="18" fill="#7f67ff" />
            <path d="m104 143 6 6 10-12" fill="none" stroke="#fff" stroke-width="3" />
            <path
              d="M15 166V130m0 12-9-9m9 19 11-12"
              stroke="#6ea990"
              stroke-width="2"
              fill="none"
            />
          </svg>
        </section>
        <sc-section-card
          v-if="mode === 'sample'"
          density="compact"
          surface="plain"
          class="dashboard-browser-card"
          :title="text.browserActivity"
        >
          <template #actions>
            <router-link to="/patterns">{{ text.viewAll }} →</router-link>
          </template>
          <div class="dashboard-browser-heading">
            <span>{{ text.browser }}</span>
            <span>{{ text.sessions }}</span>
          </div>
          <div v-for="browser in browsers" :key="browser.name" class="dashboard-browser">
            <span
              class="dashboard-browser-icon"
              :style="{ background: browser.tint, color: browser.color }"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="browser.icon" /></svg>
            </span>
            <div>
              <strong>{{ browser.name }}</strong>
              <small>{{ browser.company }}</small>
            </div>
            <strong>{{ number(browser.sessions) }}</strong>
          </div>
        </sc-section-card>
        <sc-section-card
          v-if="mode === 'sample'"
          density="compact"
          surface="plain"
          :title="text.categories"
        >
          <div class="dashboard-categories">
            <div v-for="category in categories" :key="category.label">
              <span :style="{ background: category.tint, color: category.color }">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="category.icon" /></svg>
              </span>
              <strong>{{ category.label }}</strong>
              <small>{{ category.value }}</small>
            </div>
          </div>
        </sc-section-card>
        <sc-section-card
          v-if="mode === 'live'"
          density="compact"
          surface="plain"
          :title="words('업무 상태 요약', 'Workspace status summary')"
        >
          <ul class="dashboard-live-status">
            <li v-for="segment in distribution" :key="segment.label">
              <span>{{ segment.label }}</span>
              <strong>{{ number(segment.value) }}</strong>
            </li>
          </ul>
          <p class="dashboard-live-hint">{{ text.liveNote }}</p>
        </sc-section-card>
        <sc-section-card density="compact" surface="plain" :title="text.quickLinks">
          <div class="dashboard-quick-links">
            <router-link to="/patterns">
              {{ text.components }}
              <span>→</span>
            </router-link>
            <router-link to="/reports/requirements">
              {{ text.reports }}
              <span>→</span>
            </router-link>
            <router-link to="/requests">
              {{ text.requests }}
              <span>→</span>
            </router-link>
          </div>
        </sc-section-card>
      </aside>
    </div>
    <footer class="dashboard-footer">
      <span>© 2026 ScFramework</span>
      <span>{{ text.footer }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * KPI → 차트/분포 → 주문 표와 보조 위젯 순서로 공통 컴포넌트를 조립한다. sample/live 분기에 따라 표시 문구와 자료 범위가 달라진다.
 * v-for의 key는 항목 식별자, :prop은 표현식 전달, #cell-*은 표가 제공하는 행별 표시 slot이다.
 */

/**
 * 판매 디자인 예제와 실제 요구사항 집계를 같은 공통 UI로 보여주는 대시보드다. source/period 선택 원본은 Router query다.
 * sample의 매출·방문·결제·일정은 고정 예제다. live일 때만 useRequirementReport로 현재 계정의 서버 자료를 읽는다.
 * computed는 조회 결과/locale/기간에서 KPI·표·차트 입력을 만드는 계산식이다. 집계 결과를 별도 Pinia/ref에 중복 저장하지 않는다.
 * ScTableColumn<DashboardOrder> 같은 제네릭은 표의 행 타입을 연결한다. type/import type은 JavaScript 출력에서 사라지며 서버 검증을 대체하지 않는다.
 */

import { computed, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  ScActionButton,
  ScSelect,
  ScStatusBadge,
  ScKpiCard,
  ScSectionCard,
  type ScKpiCardTone,
  type ScKpiTrendDirection,
  type ScSelectOption,
} from "@sc/ui";
import { ScDataTable, type ScTableColumn, type ScTableLabels } from "@sc/ui/table";
import { ScSeriesChart, type ScChartSeries } from "@sc/ui/charts";
import {
  mdiCartOutline,
  mdiWalletOutline,
  mdiCashMultiple,
  mdiAccountGroupOutline,
  mdiDownload,
  mdiHeadphones,
  mdiKeyboardOutline,
  mdiLaptop,
  mdiBriefcaseOutline,
  mdiGoogleChrome,
  mdiMicrosoftEdge,
  mdiFirefox,
  mdiOpera,
  mdiAppleSafari,
  mdiWeb,
  mdiShoppingOutline,
} from "@mdi/js";
import { useReferenceRuntime } from "../../auth/identity";
import { useRequirementReport } from "../reports/requirements/query";
import { parseReportQuery } from "../reports/requirements/filters";

const runtime = useReferenceRuntime();
const route = useRoute();
const router = useRouter();
const { locale } = useI18n({ useScope: "global" });
const isKo = computed(() => locale.value === "ko");
const mode = computed(() => (route.query.source === "live" ? "live" : "sample"));
const period = computed(() =>
  route.query.period === "quarter" || route.query.period === "year" ? route.query.period : "month",
);
const text = computed(() =>
  isKo.value
    ? {
        title: "매출 대시보드",
        greeting: "안녕하세요",
        subtitle: "오늘의 성과를 한눈에 확인하고, 다음 기회를 발견하세요.",
        source: "대시보드 데이터",
        sample: "매출 예제",
        live: "실제 업무",
        period: "조회 기간",
        month: "이번 달",
        quarter: "이번 분기",
        year: "올해",
        export: "현재 표 CSV 내려받기",
        sampleNote: "샘플 데이터 · 디자인과 공통 컴포넌트 사용을 위한 매출 예제입니다.",
        liveNote: "실제 업무 데이터 · 현재 계정의 조회 권한을 적용한 요구사항 집계입니다.",
        revenue: "매출 현황",
        workTrend: "최근 업무 변경 추이",
        devices: "기기별 방문자",
        workStatus: "업무 상태 분포",
        distribution: "분포 합계",
        visitors: "전체 방문자",
        total: "전체 건수",
        channels: "매출 상위 채널",
        viewAll: "전체 보기",
        channelTotal: "전체 매출",
        transactions: "최근 결제",
        onlinePayment: "온라인 결제",
        schedule: "예정된 일정",
        orders: "최근 주문",
        recentWork: "최근 요구사항",
        product: "상품 / 업무",
        customer: "고객 / 작성자",
        amount: "금액 / 이력",
        status: "상태",
        date: "날짜",
        widgets: "대시보드 위젯",
        promoTitle: "더 좋은 화면을, 더 빠르게",
        promoDescription: "입력·표·차트·대시보드를 공통 컴포넌트로 조립하세요.",
        promoAction: "컴포넌트 살펴보기",
        browserActivity: "브라우저 활동",
        browser: "브라우저",
        sessions: "세션",
        categories: "판매 상위 카테고리",
        quickLinks: "바로가기",
        components: "공통 UI 예제",
        reports: "업무 보고서",
        requests: "요구사항 목록",
        footer: "독립 UI 프레임워크 · 매출 레퍼런스",
        chartData: "차트 데이터 보기",
        noData: "표시할 데이터가 없습니다.",
        loading: "불러오는 중",
        retry: "다시 조회",
      }
    : {
        title: "Sales dashboard",
        greeting: "Hello there",
        subtitle: "See today's performance and discover your next opportunity.",
        source: "Dashboard data",
        sample: "Sales example",
        live: "Live workspace",
        period: "Period",
        month: "This month",
        quarter: "This quarter",
        year: "This year",
        export: "Download current table as CSV",
        sampleNote: "Sample data · A sales example for the design and shared components.",
        liveNote: "Live workspace · Requirement totals respect your account's permissions.",
        revenue: "Sales revenue",
        workTrend: "Recent workspace changes",
        devices: "Visitors by device",
        workStatus: "Workspace status",
        distribution: "Distribution total",
        visitors: "Total visitors",
        total: "Total items",
        channels: "Top revenue channels",
        viewAll: "View all",
        channelTotal: "Overall revenue",
        transactions: "Recent transactions",
        onlinePayment: "Online transaction",
        schedule: "Upcoming events",
        orders: "Recent orders",
        recentWork: "Recent requirements",
        product: "Product / work item",
        customer: "Customer / author",
        amount: "Amount / history",
        status: "Status",
        date: "Date",
        widgets: "Dashboard widgets",
        promoTitle: "Build better screens",
        promoDescription: "Shared components for your next workspace.",
        promoAction: "Explore components",
        browserActivity: "Browser activity",
        browser: "Browser",
        sessions: "Sessions",
        categories: "Top categories by sales",
        quickLinks: "Quick links",
        components: "Shared UI examples",
        reports: "Workspace reports",
        requests: "Requirements",
        footer: "Independent UI framework · Sales reference",
        chartData: "View chart data",
        noData: "No data to display.",
        loading: "Loading",
        retry: "Reload",
      },
);
const periodLabel = computed(() =>
  period.value === "quarter"
    ? text.value.quarter
    : period.value === "year"
      ? text.value.year
      : text.value.month,
);
const reportFilters = computed(
  () => parseReportQuery({ page: "0", size: "20", sort: "updatedAt", direction: "desc" }).filters,
);
/**
 * 실제 업무 모드에서만 서버 보고서를 활성화한다. sample 기간 배수는 시각 예제이며 live API에 기간 검색 조건을 추가하는 값이 아니다.
 */
const report = useRequirementReport(
  reportFilters,
  computed(() => mode.value === "live"),
);
const number = (value: number) =>
  new Intl.NumberFormat(isKo.value ? "ko-KR" : "en-US").format(value);
const words = (ko: string, en: string) => (isKo.value ? ko : en);
const multiplier = computed(() =>
  period.value === "quarter" ? 3 : period.value === "year" ? 10 : 1,
);
const cards = computed(() => {
  const stats = report.data.value?.stats;
  const labels =
    mode.value === "sample"
      ? [
          words("전체 주문", "Number of sales"),
          words("판매 이익", "Profit by sale"),
          words("총 매출", "Total revenue"),
          words("전체 고객", "Total customers"),
        ]
      : [
          words("전체 요구사항", "All requirements"),
          words("검토 중", "In review"),
          words("검토 요청", "Requested"),
          words("합의 완료", "Agreed"),
        ];
  const sample = [
    number(12480 * multiplier.value),
    "₩" +
      new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
        31420000 * multiplier.value,
      ),
    "₩" +
      new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
        84260000 * multiplier.value,
      ),
    number(3528 * multiplier.value),
  ];
  const live = [
    report.data.value?.total ?? 0,
    stats?.REVIEWING ?? 0,
    stats?.REQUESTED ?? 0,
    (stats?.AGREED ?? 0) + (stats?.ADO_LINKED ?? 0),
  ];
  const tones: ScKpiCardTone[] = ["green", "violet", "pink", "amber"];
  const directions: ScKpiTrendDirection[] = ["up", "up", "down", "up"];
  return labels.map((label, index) => ({
    label,
    value:
      mode.value === "sample"
        ? sample[index]!
        : report.isFetching.value
          ? "…"
          : number(live[index]!),
    note:
      mode.value === "sample"
        ? words("전월 대비", "Compared with last month")
        : words("전체 조회 조건", "Across your visible workspace"),
    trend: mode.value === "sample" ? ["2.5%", "1.8%", "3.4%", "4.2%"][index]! : "",
    direction: directions[index]!,
    tone: tones[index]!,
    icon: [mdiCartOutline, mdiWalletOutline, mdiCashMultiple, mdiAccountGroupOutline][index]!,
  }));
});
/**
 * live 차트는 최근 20개 조회 행의 수정일 분포이고 전체 기간 이력 통계가 아니다. KPI와 상태 분포는 응답 stats/total을 사용한다.
 */
const chartSeries = computed<ScChartSeries[]>(() => {
  if (mode.value === "live") {
    const days = new Map<string, number>();
    for (const item of report.data.value?.items ?? []) {
      const day = item.updatedAt.slice(0, 10);
      days.set(day, (days.get(day) ?? 0) + 1);
    }
    return [
      {
        name: words("최근 20건의 수정일 분포", "Changes in the latest 20 items"),
        color: "#7f67ff",
        data: [...days]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([label, value]) => ({ label, value })),
      },
    ];
  }
  const points = period.value === "year" ? 12 : period.value === "quarter" ? 45 : 30;
  return [
    {
      name: words("주문 완료", "Delivered"),
      color: "#7f67ff",
      data: Array.from({ length: points }, (_, index) => ({
        label: String(index + 1),
        value: Math.round(
          (35 + index * 8 + Math.sin(index * 0.9) * 19 + Math.cos(index * 2.4) * 12) *
            multiplier.value,
        ),
      })),
    },
    {
      name: words("재구매", "Returning"),
      color: "#03b562",
      data: Array.from({ length: points }, (_, index) => ({
        label: String(index + 1),
        value: Math.round(
          (20 + index * 6 + Math.sin(index * 0.6) * 48 + Math.cos(index * 1.7) * 9) *
            multiplier.value,
        ),
      })),
    },
  ];
});
const distribution = computed(() => {
  const stats = report.data.value?.stats;
  const entries =
    mode.value === "sample"
      ? [
          { label: words("모바일", "Mobile"), value: 18240, color: "#16bd75" },
          { label: words("데스크톱", "Desktop"), value: 12760, color: "#8e75ff" },
          { label: words("노트북", "Laptop"), value: 8390, color: "#fd5a7c" },
          { label: words("태블릿", "Tablet"), value: 16470, color: "#ffb51b" },
        ]
      : [
          {
            label: words("검토 요청", "Requested"),
            value: (stats?.REQUESTED ?? 0) + (stats?.NEEDS_INFO ?? 0),
            color: "#16bd75",
          },
          { label: words("검토 중", "Reviewing"), value: stats?.REVIEWING ?? 0, color: "#8e75ff" },
          { label: words("작성 중", "Draft"), value: stats?.DRAFT ?? 0, color: "#fd5a7c" },
          {
            label: words("합의 완료", "Agreed"),
            value: (stats?.AGREED ?? 0) + (stats?.ADO_LINKED ?? 0),
            color: "#ffb51b",
          },
        ];
  const sum = entries.reduce((value, item) => value + item.value, 0);
  return entries.map((item) => ({
    ...item,
    percent: sum ? Math.round((item.value / sum) * 100) : 0,
  }));
});
const distributionTotal = computed(() =>
  distribution.value.reduce((sum, entry) => sum + entry.value, 0),
);
/**
 * 분포 합계 대비 각 항목 비율을 반원 SVG의 시작/끝 좌표로 바꾼다. 합계가 0이면 경로를 만들지 않아 0 나눗셈을 피한다.
 */
function arcPath(index: number) {
  if (!distributionTotal.value) return "";
  const start =
    (distribution.value.slice(0, index).reduce((sum, item) => sum + item.value, 0) /
      distributionTotal.value) *
      Math.PI +
    Math.PI;
  const end = start + (distribution.value[index]!.value / distributionTotal.value) * Math.PI;
  return (
    "M" +
    (120 + Math.cos(start) * 96) +
    " " +
    (120 + Math.sin(start) * 96) +
    " A96 96 0 " +
    (end - start > Math.PI ? 1 : 0) +
    " 1 " +
    (120 + Math.cos(end) * 96) +
    " " +
    (120 + Math.sin(end) * 96)
  );
}
const channels = computed(() => [
  { name: words("온라인 스토어", "Online store"), initial: "S", percent: 42, color: "#03b562" },
  { name: words("검색 광고", "Search ads"), initial: "G", percent: 28, color: "#7f67ff" },
  { name: words("소셜 캠페인", "Social campaign"), initial: "M", percent: 19, color: "#fd4963" },
  { name: words("제휴 채널", "Partners"), initial: "P", percent: 11, color: "#ffb51b" },
]);
const transactions = computed(() => [
  { label: words("간편 결제", "Instant payment"), value: "₩128,000" },
  { label: words("디지털 지갑", "Digital wallet"), value: "₩84,500" },
  { label: "MasterCard ****7829", value: "₩246,000" },
  { label: words("계좌 이체", "Bank transfer"), value: "₩96,000" },
]);
const events = computed(() => [
  {
    date: "OCT 14",
    title: words("가을 시즌 프로모션", "Autumn promotion"),
    tag: words("최대 30% 할인", "Up to 30% off"),
    description: words("온라인·오프라인 전체 고객", "Online and in-store customers"),
  },
  {
    date: "OCT 22",
    title: words("멤버십 특별 혜택", "Member benefits"),
    tag: words("회원 한정", "Members only"),
    description: words("다시 방문하는 고객을 위한 혜택", "Benefits for returning customers"),
  },
]);
const browsers = [
  {
    name: "Chrome",
    company: "Google",
    icon: mdiGoogleChrome,
    sessions: 1248,
    color: "#087d47",
    tint: "#e5f7ee",
  },
  {
    name: "Edge",
    company: "Microsoft",
    icon: mdiMicrosoftEdge,
    sessions: 982,
    color: "#167bb5",
    tint: "#e9f5fc",
  },
  {
    name: "Firefox",
    company: "Mozilla",
    icon: mdiFirefox,
    sessions: 816,
    color: "#bc5b12",
    tint: "#fff2e5",
  },
  {
    name: "Opera",
    company: "Opera",
    icon: mdiOpera,
    sessions: 1324,
    color: "#c8384f",
    tint: "#feecf0",
  },
  {
    name: "Safari",
    company: "Apple",
    icon: mdiAppleSafari,
    sessions: 1126,
    color: "#355db4",
    tint: "#ecf1ff",
  },
  {
    name: "Samsung Internet",
    company: "Samsung",
    icon: mdiWeb,
    sessions: 1189,
    color: "#7156d9",
    tint: "#f0ecff",
  },
];
const categories = computed(() => [
  {
    label: words("디지털", "Electronics"),
    value: "₩32.8M",
    icon: mdiLaptop,
    color: "#087d47",
    tint: "#b2e5cc",
  },
  {
    label: words("액세서리", "Accessories"),
    value: "₩21.4M",
    icon: mdiHeadphones,
    color: "#5540b8",
    tint: "#d1c5ff",
  },
  {
    label: words("오피스", "Office"),
    value: "₩18.6M",
    icon: mdiBriefcaseOutline,
    color: "#9c6108",
    tint: "#ffe0a2",
  },
  {
    label: words("라이프스타일", "Lifestyle"),
    value: "₩11.4M",
    icon: mdiShoppingOutline,
    color: "#c42f4d",
    tint: "#ffe0e7",
  },
]);
const sampleOrders = computed(() => [
  {
    id: "SC-10284",
    title: words("스튜디오 헤드폰", "Studio headphones"),
    customer: "김민수",
    amount: "₩128,000",
    status: words("배송 완료", "Delivered"),
    date: "2026.10.07",
    tone: "green",
    icon: mdiHeadphones,
  },
  {
    id: "SC-10283",
    title: words("무선 키보드", "Wireless keyboard"),
    customer: "이서연",
    amount: "₩84,500",
    status: words("처리 중", "Processing"),
    date: "2026.10.07",
    tone: "violet",
    icon: mdiKeyboardOutline,
  },
  {
    id: "SC-10282",
    title: words("업무용 노트북", "Work laptop"),
    customer: "박지훈",
    amount: "₩1,246,000",
    status: words("배송 완료", "Delivered"),
    date: "2026.10.06",
    tone: "green",
    icon: mdiLaptop,
  },
  {
    id: "SC-10281",
    title: words("모니터 스탠드", "Monitor stand"),
    customer: "최유진",
    amount: "₩96,000",
    status: words("결제 대기", "Pending"),
    date: "2026.10.06",
    tone: "amber",
    icon: mdiBriefcaseOutline,
  },
]);
/**
 * 서버 DTO를 화면의 주문/업무 공통 행 모양으로 변환한다. 표시용 slice(0, 6)는 서버 전체 건수 또는 통계를 변경하지 않는다.
 */
const visibleOrders = computed(() =>
  mode.value === "sample"
    ? sampleOrders.value
    : (report.data.value?.items ?? []).slice(0, 6).map((item) => ({
        id: String(item.id),
        title: item.title,
        customer: item.authorName,
        amount: String(item.historyCount),
        status: item.status,
        date: item.updatedAt.slice(0, 10),
        tone: item.status === "AGREED" || item.status === "ADO_LINKED" ? "green" : "violet",
        icon: mdiBriefcaseOutline,
      })),
);
const sourceOptions = computed<readonly ScSelectOption[]>(() => [
  { value: "sample", label: text.value.sample },
  { value: "live", label: text.value.live },
]);
const periodOptions = computed<readonly ScSelectOption[]>(() => [
  { value: "month", label: text.value.month },
  { value: "quarter", label: text.value.quarter },
  { value: "year", label: text.value.year },
]);
type DashboardOrder = (typeof sampleOrders.value)[number];
const orderColumns = computed<readonly ScTableColumn<DashboardOrder>[]>(() => [
  { id: "product", label: text.value.product, value: (row) => row.title },
  { id: "customer", label: text.value.customer, value: (row) => row.customer },
  { id: "amount", label: text.value.amount, value: (row) => row.amount },
  { id: "status", label: text.value.status, value: (row) => row.status },
  { id: "date", label: text.value.date, value: (row) => row.date },
]);
const orderTableLabels = computed<Partial<ScTableLabels>>(() => ({
  loading: text.value.loading,
  empty: text.value.noData,
  scrollRegion: () =>
    mode.value === "sample"
      ? words("최근 주문 표", "Recent orders table")
      : words("최근 요구사항 표", "Recent requirements table"),
}));
const getOrderKey = (row: DashboardOrder) => row.id;
/**
 * 허용 값만 URL로 반영한다. replace는 선택 변경마다 브라우저 방문 이력을 쌓지 않고 현재 대시보드 URL을 갱신한다.
 */
function changeMode(value: string | null) {
  if (value !== "sample" && value !== "live") return;
  void router.replace({ query: { ...route.query, source: value } });
}
function changePeriod(value: string | null) {
  if (value !== "month" && value !== "quarter" && value !== "year") return;
  void router.replace({ query: { ...route.query, period: value } });
}
function csvValue(value: string) {
  // 조회 자료의 제목이 수식으로 실행되지 않도록 CSV 셀을 중립화한다.
  return /^[=+\-@]/.test(value.trimStart()) || /^[\t\r\n]/.test(value) ? "'" + value : value;
}
let exportUrl: string | undefined;
/**
 * 현재 화면 자료를 UTF-8 BOM CSV로 직렬화한다. 따옴표 escape와 수식 모양 셀의 중립화를 적용하고 이전 Object URL은 반환한다.
 */
function downloadCsv(rows: string[][], filename: string) {
  if (exportUrl) URL.revokeObjectURL(exportUrl);
  const content = rows
    .map((row) => row.map((cell) => '"' + csvValue(cell).replaceAll('"', '""') + '"').join(","))
    .join("\r\n");
  exportUrl = URL.createObjectURL(
    new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = exportUrl;
  link.download = filename;
  link.click();
}
/**
 * 차트에 전달한 실제 series를 CSV로 변환하므로 sample/live 선택과 다운로드 내용이 일치한다.
 */
function exportChart() {
  downloadCsv(
    [
      [
        mode.value === "sample" ? text.value.period : text.value.date,
        ...chartSeries.value.map((line) => line.name),
      ],
      ...(chartSeries.value[0]?.data ?? []).map((point, index) => [
        point.label,
        ...chartSeries.value.map((line) => String(line.data[index]?.value ?? "")),
      ]),
    ],
    "sc-dashboard-chart.csv",
  );
}
function exportRows() {
  downloadCsv(
    [
      [
        text.value.product,
        text.value.customer,
        text.value.amount,
        text.value.status,
        text.value.date,
      ],
      ...visibleOrders.value.map((item) => [
        item.title,
        item.customer,
        item.amount,
        item.status,
        item.date,
      ]),
    ],
    "sc-dashboard.csv",
  );
}
onBeforeUnmount(() => {
  if (exportUrl) URL.revokeObjectURL(exportUrl);
});
</script>

<style scoped lang="scss">
.dashboard {
  padding: 18px 12px 0;
  max-width: 1920px;
  margin-inline: auto;
}
.dashboard-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
h1 {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 2px;
}
.dashboard-heading p {
  color: var(--sc-color-text-muted);
  margin: 0;
  font-size: 13px;
}
.dashboard-controls {
  display: flex;
  align-items: center;
  gap: var(--sc-space-2);
  flex-shrink: 0;
}
svg {
  fill: currentColor;
}
.dashboard-data-note {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  color: var(--sc-color-text-muted);
  margin: 0;
  line-height: 1.5;
}
.dashboard-data-source {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  white-space: nowrap;
}
.dashboard-data-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #087d47;
  flex: 0 0 auto;
}
.dashboard-layout {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
}
.dashboard-main {
  grid-column: span 3;
}
.dashboard-main,
.dashboard-widgets {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 24px;
}
.dashboard-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
  min-height: 148px;
}
.dashboard-chart-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.dashboard-revenue {
  grid-column: span 2;
}
.dashboard-small-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.dashboard-card-period {
  font-size: 12px;
  color: var(--sc-color-primary);
  background: color-mix(in srgb, #03b562 13%, white);
  border-radius: 4px;
  padding: 6px 10px;
  text-decoration: none;
  white-space: nowrap;
}
.dashboard a:hover {
  color: var(--sc-color-primary);
  text-decoration: underline;
}
.dashboard-gauge {
  padding: 8px 0 20px;
  margin-inline: -12px;
}
.dashboard-gauge svg {
  display: block;
  width: 100%;
  max-width: 280px;
  margin-inline: auto;
}
.dashboard-gauge-label {
  font-size: 12px;
  fill: var(--sc-color-text);
}
.dashboard-gauge-value {
  font-size: 23px;
  font-weight: 650;
  fill: var(--sc-color-text);
}
.dashboard-distribution {
  list-style: none;
  margin: 8px -16px -16px;
  padding: 0;
}
.dashboard-distribution li {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 13px 16px;
  border-top: 1px solid var(--sc-color-border);
  font-size: 13px;
}
.dashboard-distribution small {
  color: var(--sc-color-text-muted);
  font-size: 12px;
}
.dashboard-distribution strong {
  font-weight: 600;
}
.dashboard-dot {
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--dot-color);
  border-radius: 50%;
}
.dashboard-channel-bar {
  display: flex;
  gap: 3px;
  height: 9px;
  border-radius: 20px;
  overflow: hidden;
  margin: 4px 0 14px;
}
.dashboard-channel-bar span {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 4px,
    #ffffff4d 4px,
    #ffffff4d 8px
  ) !important;
}
.dashboard-channel-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  margin: 0 0 15px;
}
.dashboard-channel {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 12px 0;
  padding: 9px;
  border: 1px solid var(--sc-color-border);
  border-radius: 6px;
  font-size: 12px;
}
.dashboard-channel > div {
  flex: 1;
  min-width: 0;
}
.dashboard-channel strong {
  font-size: 13px;
}
.dashboard-channel-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: #f3f6fa;
  border-radius: 50%;
  font-weight: 700;
  font-size: 14px;
}
.dashboard-progress {
  height: 4px;
  background: #f2f4f8;
  margin-top: 7px;
}
.dashboard-progress span {
  display: block;
  height: 100%;
}
.dashboard-transaction {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 16px 0;
  border-bottom: 1px solid var(--sc-color-border);
  font-size: 12px;
}
.dashboard-transaction:last-child {
  border: 0;
}
.dashboard-transaction > div {
  flex: 1;
  min-width: 0;
}
.dashboard-transaction > strong {
  white-space: nowrap;
}
.dashboard-transaction div strong {
  font-size: 13px;
  display: block;
  overflow-wrap: anywhere;
}
.dashboard-transaction small {
  display: block;
  color: var(--sc-color-text-muted);
  font-size: 12px;
  margin-top: 4px;
}
.dashboard-payment-icon {
  width: 33px;
  height: 33px;
  flex: 0 0 auto;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #e5f8ef;
  color: #087d47;
}
.dashboard-payment-icon svg {
  width: 16px;
  height: 16px;
}
.payment-1 {
  color: #7050cb;
  background: #f1eefe;
}
.payment-2 {
  color: #c83b55;
  background: #fff0f3;
}
.payment-3 {
  color: #98610f;
  background: #fff6e3;
}
.dashboard-timeline {
  list-style: none;
  padding: 2px 0;
  margin: 0;
}
.dashboard-timeline li {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 10px;
  padding-block: 14px;
}
.dashboard-timeline time {
  padding-top: 12px;
  color: var(--sc-color-text-muted);
  font-size: 12px;
}
.dashboard-timeline li > div {
  position: relative;
  padding: 10px;
  border: 1px dashed var(--sc-color-border);
  border-radius: 5px;
}
.dashboard-timeline li > div::before {
  content: "";
  position: absolute;
  left: -7px;
  top: 19px;
  height: 9px;
  width: 9px;
  border: 2px solid #03b562;
  border-radius: 50%;
  background: white;
}
.dashboard-timeline li:nth-child(2) > div::before {
  border-color: #7f67ff;
}
.dashboard-timeline strong {
  display: block;
  font-size: 12px;
}
.dashboard-timeline span {
  display: inline-block;
  margin-block: 5px;
  padding: 2px 4px;
  color: #087d47;
  background: #e6f8ed;
  font-size: 12px;
}
.dashboard-timeline p {
  font-size: 12px;
  color: var(--sc-color-text-muted);
  margin: 0;
}
.dashboard-promotion {
  position: relative;
  min-height: 210px;
  padding: 24px;
  overflow: hidden;
  border: 1px dashed #7fcda5;
  border-radius: 8px;
  background: linear-gradient(110deg, #d5f1e3, #f6fcf8);
}
.dashboard-promotion > div {
  width: 65%;
  position: relative;
  z-index: 1;
}
.dashboard-promotion h2 {
  max-width: 160px;
  font-size: 20px;
  line-height: 1.3;
  font-weight: 650;
  margin: 0 0 10px;
}
.dashboard-promotion p {
  max-width: 155px;
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 16px;
}
.dashboard-promotion a {
  color: #087d47;
  font-size: 12px;
  font-weight: 600;
}
.dashboard-promotion-art {
  position: absolute;
  width: 132px;
  height: 170px;
  right: -3px;
  bottom: 5px;
}
.dashboard-browser-heading {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 4px 0 13px;
}
.dashboard-browser {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 0;
  border-top: 1px solid var(--sc-color-border);
}
.dashboard-browser > div {
  flex: 1;
  min-width: 0;
}
.dashboard-browser strong {
  font-size: 13px;
  font-weight: 550;
}
.dashboard-browser small {
  display: block;
  font-size: 12px;
  color: var(--sc-color-text-muted);
  margin-top: 2px;
}
.dashboard-browser-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  font-size: 20px;
  font-weight: 600;
}
.dashboard-browser-icon svg {
  width: 24px;
  height: 24px;
}
.dashboard-categories {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-block: 7px;
}
.dashboard-categories > div {
  text-align: center;
  padding: 12px 4px;
  border: 1px dashed var(--sc-color-border);
  border-radius: 6px;
}
.dashboard-categories span {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  margin: 0 auto 10px;
  border-radius: 5px;
}
.dashboard-categories svg {
  width: 22px;
  height: 22px;
}
.dashboard-categories strong,
.dashboard-categories small {
  display: block;
  font-size: 12px;
}
.dashboard-categories small {
  margin-top: 4px;
  color: var(--sc-color-text-muted);
}
.dashboard-quick-links {
  display: grid;
  gap: 8px;
}
.dashboard-quick-links a {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  color: var(--sc-color-text);
  font-size: 12px;
  text-decoration: none;
}
/* 상품 구성은 업무 slot이 소유하고 표의 여백·색·반응형은 공통 표가 소유한다. */
.dashboard-product-cell {
  display: flex;
  gap: var(--sc-space-3);
  align-items: center;
}
.dashboard-product-cell small {
  display: block;
  font-size: var(--sc-font-size-small);
  color: var(--sc-color-text-muted);
  margin-top: var(--sc-space-1);
}
.dashboard-product-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  background: #e6f7ef;
  color: #087d47;
  border-radius: 7px;
  flex-shrink: 0;
}
.dashboard-product-icon svg {
  width: 22px;
  height: 22px;
}
.product-violet {
  color: #6650b7;
  background: #efebff;
}
.product-amber {
  color: #98610f;
  background: #fff5df;
}
.dashboard-table-avatar {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  font-size: 12px;
  color: #3b497e;
  background: #edf0fa;
  margin-right: 7px;
  border-radius: 50%;
}
.dashboard-live-status {
  list-style: none;
  padding: 0;
  margin: 0;
}
.dashboard-live-status li {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--sc-color-border);
}
.dashboard-live-hint {
  font-size: 12px;
  color: var(--sc-color-text-muted);
  line-height: 1.7;
}
.dashboard-error {
  padding: 12px;
  background: #fff2f2;
  color: var(--sc-color-error);
}
.dashboard-footer {
  display: flex;
  justify-content: space-between;
  padding: 24px 0;
  font-size: 12px;
  color: var(--sc-color-text-muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
@media (min-width: 1600px) {
  .dashboard-gauge {
    padding-block: 30px;
  }
  .dashboard-small-grid {
    gap: 24px;
  }
}
@media (max-width: 1279px) {
  .dashboard-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .dashboard-main {
    grid-column: auto;
  }
  .dashboard-widgets {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
  }
  .dashboard-quick-links {
    grid-column: auto;
  }
}
@media (min-width: 1280px) and (max-width: 1399px) {
  .dashboard-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 999px) {
  .dashboard-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dashboard-small-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .dashboard-widgets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .dashboard {
    padding: 20px 12px 0;
  }
  .dashboard-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }
  .dashboard-controls {
    width: 100%;
  }
  .dashboard-kpis,
  .dashboard-chart-grid,
  .dashboard-widgets {
    grid-template-columns: minmax(0, 1fr);
  }
  .dashboard-kpis {
    gap: 24px;
    min-height: 0;
  }
  .dashboard-revenue {
    grid-column: auto;
  }
  .dashboard-data-note {
    line-height: 1.6;
  }
  .dashboard-layout,
  .dashboard-main {
    gap: 24px;
  }
  .dashboard-widgets {
    display: grid;
  }
  .dashboard-footer {
    flex-direction: column;
    gap: 7px;
  }
  .dashboard-promotion-art {
    right: 16px;
  }
}
</style>
