<template>
  <div class="sc-story-locale" :lang="locale"><slot /></div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * Story 콘텐츠의 lang 속성과 default slot을 함께 제공한다. 실제 번역은 아래 두 라이브러리의 locale에 연결한다.
 */

/*
 * Storybook에서 선택한 locale prop을 Vue I18n과 Vuetify의 서로 다른 locale ref에 동기화한다.
 *  watch의 immediate:true는 최초 렌더에서도 선택 언어를 적용한다. 사용자 계정이나 앱의 언어 저장 정책은 이 fixture가 소유하지 않는다.
 */
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import { useLocale } from "vuetify";
import type { ScLocale } from "@sc/i18n";
const props = defineProps<{ locale: ScLocale }>();
const { locale: messageLocale } = useI18n({ useScope: "global" });
const { current: vuetifyLocale } = useLocale();
watch(
  () => props.locale,
  (value) => {
    messageLocale.value = value;
    vuetifyLocale.value = value;
  },
  { immediate: true },
);
</script>
