<template>
  <section class="sc-stack" aria-label="다국어 중립 예제" :lang="locale">
    <div class="sc-inline">
      <sc-action-button @click="changeLocale">한국어/English</sc-action-button>
      <span role="status" aria-label="현재 언어">{{ locale }}</span>
    </div>
    <sc-text-field v-model="draft" :label="t('app.title')" />
    <sc-action-button>{{ t("common.actions.save") }}</sc-action-button>
    <p role="status" aria-label="다국어 입력">{{ draft }}</p>
    <p>{{ t("app.onlyKorean") }}</p>
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 한국어/영어 전환 후 공통 저장 문구와 앱 제목을 표시한다. 입력 draft는 언어가 바뀌어도 같은 ref를 유지한다.
 */

/*
 * useI18n local scope로 Story만의 locale/messages를 만든다. inheritLocale:false라 다른 Story의 선택을 상속하지 않는다.
 *  영어에 없는 onlyKorean은 한국어 fallback을 보여 준다. Vuetify의 별도 locale도 watch로 맞춰 기본 UI 문구가 같은 언어를 사용하게 한다.
 */
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useLocale } from "vuetify";
import { ScActionButton, ScTextField } from "@sc/ui";
import { commonMessages } from "@sc/i18n";
const { locale, t } = useI18n({
  useScope: "local",
  inheritLocale: false,
  locale: "ko",
  fallbackLocale: "ko",
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    ko: { ...commonMessages.ko, app: { title: "제목", onlyKorean: "한국어 fallback 문구" } },
    en: { ...commonMessages.en, app: { title: "Title" } },
  },
});
const vuetifyLocale = useLocale();
const draft = ref("");
// Storybook 공유 Vue 앱의 Vuetify locale을 잠시 바꾸므로 시작 값을 기억했다가 unmount에서 복원한다.
const originalVuetifyLocale = vuetifyLocale.current.value;
watch(locale, (value) => {
  vuetifyLocale.current.value = value;
});
function changeLocale() {
  locale.value = locale.value === "ko" ? "en" : "ko";
}
// Storybook의 공통 Vue 앱 locale은 다음 story의 선택 상태가 되지 않는다.
import { onBeforeUnmount } from "vue";
onBeforeUnmount(() => {
  vuetifyLocale.current.value = originalVuetifyLocale;
});
</script>
