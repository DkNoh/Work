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
