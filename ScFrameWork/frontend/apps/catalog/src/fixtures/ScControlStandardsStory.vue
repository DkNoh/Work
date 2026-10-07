<template>
  <article class="sc-stack sc-control-standards" aria-label="공통 디자인 규격">
    <header class="sc-stack">
      <h1>ScFramework 공통 디자인 규격</h1>
      <p>
        버튼·입력·카드를 props로 조립합니다. 아래 예제는 컴포넌트 내부 스타일을 덮어쓰지 않습니다.
      </p>
    </header>

    <sc-section-card title="버튼 크기와 동작" density="compact">
      <div class="sc-stack">
        <div class="sc-actions" role="group" aria-label="버튼 크기">
          <sc-action-button size="sm" @click="executeAction">작은 버튼</sc-action-button>
          <sc-action-button size="md" @click="executeAction">기본 버튼</sc-action-button>
          <sc-action-button size="lg" @click="executeAction">큰 버튼</sc-action-button>
          <sc-action-button
            size="sm"
            intent="secondary"
            variant="outlined"
            :icon-path="mdiDownload"
            @click="executeAction"
          >
            내보내기
          </sc-action-button>
          <sc-action-button
            size="sm"
            intent="neutral"
            variant="text"
            :icon-path="mdiRefresh"
            icon-only
            aria-label="공통 디자인 새로 조회"
            @click="executeAction"
          />
        </div>
        <div class="sc-actions" role="group" aria-label="버튼 표현">
          <sc-action-button variant="flat">채움</sc-action-button>
          <sc-action-button variant="tonal">옅은 채움</sc-action-button>
          <sc-action-button variant="outlined">테두리</sc-action-button>
          <sc-action-button variant="text">텍스트</sc-action-button>
        </div>
        <div class="sc-actions" role="group" aria-label="버튼 의미색">
          <sc-action-button intent="primary">주요 행동</sc-action-button>
          <sc-action-button intent="secondary">보조 행동</sc-action-button>
          <sc-action-button intent="success">완료 처리</sc-action-button>
          <sc-action-button intent="warning">확인 필요</sc-action-button>
          <sc-action-button intent="danger">삭제</sc-action-button>
          <sc-action-button intent="neutral">중립 행동</sc-action-button>
        </div>
        <div class="sc-actions" role="group" aria-label="버튼 처리 상태">
          <sc-action-button disabled @click="executeAction">비활성 버튼</sc-action-button>
          <sc-action-button busy busy-label="저장 중…" @click="executeAction">
            저장
          </sc-action-button>
        </div>
        <p role="status" aria-label="디자인 예제 실행 횟수">실행 {{ actionCount }}회</p>
      </div>
    </sc-section-card>

    <div class="sc-control-standards__grid">
      <sc-section-card title="기본 입력과 카드" description="comfortable · bordered">
        <div class="sc-stack">
          <sc-text-field v-model="defaultTitle" label="기본 제목" />
          <sc-select v-model="defaultCategory" label="기본 구분" :options="categoryOptions" />
          <sc-kpi-card label="기본 요청 건수" value="1,248" note="이번 달" />
        </div>
      </sc-section-card>
      <sc-section-card
        title="간결한 입력과 카드"
        description="compact · plain"
        density="compact"
        surface="plain"
      >
        <div class="sc-stack">
          <sc-text-field v-model="compactTitle" label="간결한 제목" density="compact" />
          <sc-select
            v-model="compactCategory"
            label="간결한 구분"
            :options="categoryOptions"
            density="compact"
          />
          <sc-kpi-card label="간결한 요청 건수" value="1,248" note="이번 달" density="compact" />
        </div>
      </sc-section-card>
    </div>

    <sc-section-card title="헤더·필터 선택" density="compact">
      <div class="sc-actions">
        <sc-select
          v-model="period"
          label="조회 기간"
          :options="periodOptions"
          presentation="toolbar"
          density="compact"
          tone="primary"
        />
        <sc-action-button size="sm" :icon-path="mdiRefresh" @click="executeAction">
          조회
        </sc-action-button>
        <span role="status" aria-label="선택 기간">{{ period }}</span>
      </div>
    </sc-section-card>

    <sc-section-card title="상태 배지" density="compact">
      <div class="sc-actions">
        <sc-status-badge v-for="badge in badges" :key="badge.tone" v-bind="badge" />
      </div>
    </sc-section-card>
  </article>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { mdiDownload, mdiRefresh } from "@mdi/js";
import {
  ScActionButton,
  ScKpiCard,
  ScSectionCard,
  ScSelect,
  ScStatusBadge,
  ScTextField,
  type ScStatusBadgeProps,
} from "@sc/ui";

const actionCount = ref(0);
const defaultTitle = ref("");
const compactTitle = ref("");
const defaultCategory = ref<string | null>("general");
const compactCategory = ref<string | null>("general");
const period = ref<string | null>("month");
const categoryOptions = [
  { value: "general", label: "일반 업무" },
  { value: "review", label: "검토 업무" },
];
const periodOptions = [
  { value: "month", label: "이번 달" },
  { value: "quarter", label: "이번 분기" },
];
const badges: readonly ScStatusBadgeProps[] = [
  { label: "작성 중", tone: "neutral" },
  { label: "진행 중", tone: "primary" },
  { label: "검토 중", tone: "secondary" },
  { label: "처리 완료", tone: "success" },
  { label: "확인 필요", tone: "warning" },
  { label: "처리 실패", tone: "danger" },
  { label: "안내", tone: "info" },
];
function executeAction() {
  actionCount.value += 1;
}
</script>

<style scoped lang="scss">
@use "@sc/ui/tokens" with (
  $sc-emit-css: false
);
.sc-control-standards__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sc-space-6);
}
@media (max-width: #{tokens.$sc-breakpoint-sm - 1px}) {
  .sc-control-standards__grid {
    grid-template-columns: 1fr;
  }
}
</style>
