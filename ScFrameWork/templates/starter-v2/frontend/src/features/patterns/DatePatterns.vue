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
