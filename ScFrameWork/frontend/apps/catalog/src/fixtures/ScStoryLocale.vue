<template>
  <div class="sc-story-locale" :lang="locale"><slot /></div>
</template>
<script setup lang="ts">
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
