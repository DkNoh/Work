<template>
  <section class="sc-content sc-stack">
    <sc-page-header :title="t('app.patterns')" />
    <sc-section-card
      :title="designLabels.title"
      :description="designLabels.description"
      density="compact"
      surface="plain"
    >
      <div class="sc-stack">
        <div class="sc-actions" role="group" :aria-label="designLabels.buttons">
          <sc-action-button size="sm" @click="executeDesignAction">
            {{ designLabels.small }}
          </sc-action-button>
          <sc-action-button
            size="md"
            intent="secondary"
            variant="tonal"
            @click="executeDesignAction"
          >
            {{ designLabels.medium }}
          </sc-action-button>
          <sc-action-button
            size="lg"
            intent="danger"
            variant="outlined"
            @click="executeDesignAction"
          >
            {{ designLabels.large }}
          </sc-action-button>
          <sc-action-button
            size="sm"
            intent="neutral"
            variant="text"
            :icon-path="mdiRefresh"
            icon-only
            :aria-label="designLabels.refresh"
            @click="executeDesignAction"
          />
          <sc-status-badge :label="designLabels.ready" tone="success" />
          <span role="status" :aria-label="designLabels.count">{{ designActionCount }}</span>
        </div>
        <sc-text-field v-model="designTitle" :label="designLabels.input" density="compact" />
        <sc-select
          v-model="designCategory"
          :label="designLabels.select"
          :options="designOptions"
          density="compact"
        />
      </div>
    </sc-section-card>
    <pattern-form />
    <table-patterns />
    <extension-patterns />
  </section>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 상단은 같은 공통 컴포넌트의 prop 변형을 비교하고, 아래는 목적별 하위 SFC를 조립한다.
 */

/**
 * 공통 UI를 실제 SFC에서 조립하는 Reference 예제 화면이다. 디자인 prop과 폼/표/차트/에디터/Excel 하위 예제를 한곳에 배치한다.
 * designActionCount/title/category는 이 화면의 임시 시연 상태다. 실행 횟수나 입력을 서버에 저장하는 업무 기능은 아니다.
 * 버튼 크기/색/밀도는 공개 props로 선택하고 컴포넌트 내부 CSS를 복제하지 않는다. 번역/옵션은 computed로 locale을 따라간다.
 */

import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { mdiRefresh } from "@mdi/js";
import {
  ScActionButton,
  ScPageHeader,
  ScSectionCard,
  ScSelect,
  ScStatusBadge,
  ScTextField,
} from "@sc/ui";
import PatternForm from "./PatternForm.vue";
import TablePatterns from "./TablePatterns.vue";
import ExtensionPatterns from "./ExtensionPatterns.vue";
const { t, locale } = useI18n({ useScope: "global" });
const designActionCount = ref(0);
const designTitle = ref("");
const designCategory = ref<string | null>("general");
const designLabels = computed(() =>
  locale.value === "ko"
    ? {
        title: "공통 디자인 규격",
        description:
          "같은 Sc 컴포넌트를 props로 조립합니다. 버튼·입력 내부 스타일을 별도로 작성하지 않습니다.",
        buttons: "공통 버튼 예제",
        small: "작은 버튼",
        medium: "기본 버튼",
        large: "큰 버튼",
        refresh: "디자인 예제 새로 조회",
        ready: "사용 준비",
        count: "디자인 예제 실행 횟수",
        input: "간결한 제목",
        select: "간결한 구분",
      }
    : {
        title: "Shared design standards",
        description:
          "Compose Sc components with props. Buttons and fields share their internal styles.",
        buttons: "Shared button examples",
        small: "Small button",
        medium: "Default button",
        large: "Large button",
        refresh: "Refresh design example",
        ready: "Ready",
        count: "Design example action count",
        input: "Compact title",
        select: "Compact category",
      },
);
const designOptions = computed(() => [
  { value: "general", label: locale.value === "ko" ? "일반 업무" : "General" },
  { value: "review", label: locale.value === "ko" ? "검토 업무" : "Review" },
]);
function executeDesignAction() {
  designActionCount.value += 1;
}
</script>
