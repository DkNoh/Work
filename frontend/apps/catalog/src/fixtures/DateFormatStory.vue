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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 달력 날짜와 UTC 원문 입력, locale 전환, DST 경계 버튼 및 각각의 표시 결과를 보여 준다.
 */

/*
 * 실제 @sc/date 공개 factory/파서를 사용하는 합성 예제다. calendarDate와 utcTimestamp는 별개 ref라 달력 날짜를 시각으로 임의 변환하지 않는다.
 *  formatter는 locale/timeZone에 따른 computed이고 parsed는 UTC 원문 보존을 보여 준다. DateLocale type은 허용 언어를 검사한다.
 */
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
// 고정된 UTC 시각을 뉴욕 DST 전환 시점으로 바꿔 같은 원문도 표시 시간대에 따라 달라지는 것을 확인한다.
function showDstBoundary() {
  timeZone.value = "America/New_York";
  utcTimestamp.value = "2026-03-08T07:00:00Z";
}
</script>
