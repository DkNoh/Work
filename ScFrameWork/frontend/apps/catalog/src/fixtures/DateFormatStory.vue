<template>
  <section class="sc-stack" aria-label="날짜 모듈 예제">
    <h1>달력 날짜와 UTC 시각</h1>
    <sc-text-field v-model="calendarDate" label="달력 날짜" />
    <sc-text-field v-model="utcTimestamp" label="UTC 원문" />
    <div class="sc-inline">
      <sc-action-button @click="dateLocale = dateLocale === 'ko' ? 'en' : 'ko'">
        날짜 한국어/English
      </sc-action-button>
      <sc-action-button @click="showDstBoundary">DST 경계 보기</sc-action-button>
    </div>
    <p role="status" aria-label="달력 표시">{{ formatter.formatCalendarDate(calendarDate) }}</p>
    <p role="status" aria-label="시각 표시">{{ formatter.formatTimestamp(utcTimestamp) }}</p>
    <p role="status" aria-label="UTC 보존 원문">{{ parsed.raw }}</p>
    <p>{{ formatter.timeZone }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { createDateFormatter, parseUtcTimestamp, type DateLocale } from "@sc/date";
import { ScActionButton, ScTextField } from "@sc/ui";
const calendarDate = ref("2026-10-06");
const utcTimestamp = ref("2026-10-06T00:00:00.123456789Z");
const dateLocale = ref<DateLocale>("ko");
const timeZone = ref("Asia/Seoul");
const formatter = computed(() =>
  createDateFormatter({ locale: dateLocale.value, timeZone: timeZone.value }),
);
const parsed = computed(() => parseUtcTimestamp(utcTimestamp.value));
function showDstBoundary() {
  timeZone.value = "America/New_York";
  utcTimestamp.value = "2026-03-08T07:00:00Z";
}
</script>
