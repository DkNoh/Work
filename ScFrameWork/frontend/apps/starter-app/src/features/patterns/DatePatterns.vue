<template>
  <sc-section-card :title="t('date.title')" :description="t('date.hint')">
    <div class="date-inputs">
      <sc-text-field v-model="calendarDate" :label="t('date.calendar')" />
      <sc-text-field v-model="utcTimestamp" :label="t('date.timestamp')" />
      <sc-select v-model="timeZone" :label="t('date.zone')" :options="zones" />
      <sc-select v-model="dateLocale" :label="t('date.locale')" :options="locales" />
    </div>
    <dl class="date-results">
      <div>
        <dt>{{ t("date.calendarResult") }}</dt>
        <dd data-testid="date-calendar-result">{{ formatter.formatCalendarDate(calendarDate) }}</dd>
      </div>
      <div>
        <dt>{{ t("date.timestampResult") }}</dt>
        <dd data-testid="date-timestamp-result">{{ formatter.formatTimestamp(utcTimestamp) }}</dd>
      </div>
      <div>
        <dt>{{ t("date.raw") }}</dt>
        <dd>
          <code data-testid="date-raw-timestamp">{{ parsed.raw ?? "—" }}</code>
        </dd>
      </div>
      <div>
        <dt>{{ t("date.validity") }}</dt>
        <dd>{{ parsed.kind }}</dd>
      </div>
    </dl>
    <p>{{ t("date.scope") }}</p>
  </sc-section-card>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 날짜·UTC 입력 원문과 선택한 시간대의 표시 결과를 나란히 보여준다. 이 화면은 서버 날짜를 갱신하지 않는다.
 */

/**
 * 달력 날짜와 UTC timestamp가 서로 다른 자료임을 보여주는 날짜 포맷 예제다. 브라우저 입력 원문은 ref로 보존한다.
 * 선택한 표시 언어/시간대로 formatter를 computed에서 다시 만든다. 표시 시간대를 바꾸어도 원본 UTC 값을 다시 저장하지 않는다.
 * parseUtcTimestamp는 입력을 실제로 검증하고 나노초 부분을 보존하는 공통 함수다. TypeScript string 타입은 날짜의 유효성을 보장하지 않는다.
 */

import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { createDateFormatter, parseUtcTimestamp } from "@sc/date";
import { ScSectionCard, ScSelect, ScTextField } from "@sc/ui";
const { t } = useI18n({ useScope: "global" });
const calendarDate = ref("2026-10-06");
const utcTimestamp = ref("2026-10-06T00:00:00.123456789Z");
const timeZone = ref<string | null>("Asia/Seoul");
const dateLocale = ref<string | null>("ko");
const zones = ["UTC", "Asia/Seoul", "America/New_York"].map((value) => ({ value, label: value }));
const locales = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
];
const formatter = computed(() =>
  createDateFormatter({
    locale: dateLocale.value === "en" ? "en" : "ko",
    timeZone: timeZone.value ?? "UTC",
  }),
);
const parsed = computed(() => parseUtcTimestamp(utcTimestamp.value));
</script>

<style scoped>
.date-inputs {
  display: grid;
  gap: var(--sc-space-4);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
}
.date-results {
  display: grid;
  gap: var(--sc-space-4);
}
dt {
  color: var(--sc-color-text-muted);
}
dd {
  margin: var(--sc-space-1) 0 0;
  overflow-wrap: anywhere;
}
</style>
