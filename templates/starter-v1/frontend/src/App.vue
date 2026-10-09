<template>
  <sc-app-shell
    application-title="__APP_NAME__"
    application-label="Starter"
    :navigation-label="t('app.navigation')"
    :labels="shellLabels"
    :navigation-items="navigationItems"
    :active-item="activeItem"
    @navigate="navigateToPage"
  >
    <template #header-actions>
      <label class="app-locale">
        언어 / Language
        <select v-model="locale" aria-label="언어 / Language">
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </select>
      </label>
      <sc-action-button v-if="runtime.session.identity" @click="signOut">
        {{ t("app.logout") }}
      </sc-action-button>
    </template>
    <template #sidebar-footer>
      <p>{{ t("app.footer") }}</p>
    </template>
    <router-view />
  </sc-app-shell>
</template>
<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocale } from "vuetify";
import { ScAppShell, ScActionButton, type ScAppShellNavItem } from "@sc/ui";
import { useFrameworkRuntime } from "@sc/runtime";
import { patternsEnabled } from "./config";
const runtime = useFrameworkRuntime();
const route = useRoute();
const { t, locale } = useI18n({ useScope: "global" });
const { current } = useLocale();
watch(
  locale,
  (value) => {
    current.value = value;
    document.documentElement.lang = value;
  },
  { immediate: true },
);
const shellLabels = computed(() => ({
  skipContent: t("common.shell.skipToContent"),
  openNavigation: t("common.shell.openNavigation"),
  closeNavigation: t("common.shell.closeNavigation"),
}));
const navigationItems = computed<ScAppShellNavItem[]>(() =>
  runtime.session.identity
    ? [
        { id: "notes", label: locale.value === "ko" ? "저장 예제" : "Notes", href: "/notes" },
        ...(patternsEnabled
          ? [{ id: "patterns", label: t("app.patterns"), href: "/patterns" }]
          : []),
      ]
    : [],
);
const activeItem = computed(() => (typeof route.name === "string" ? route.name : ""));
async function navigateToPage(item: ScAppShellNavItem) {
  await runtime.router.push(item.href);
}
async function signOut() {
  await runtime.auth.logout();
  await runtime.router.replace("/login");
}
</script>
<style scoped>
.app-locale {
  display: grid;
  gap: var(--sc-space-1);
}
.app-locale select {
  color: var(--sc-color-text);
  background: var(--sc-color-surface);
  border: 1px solid var(--sc-color-control-border);
  border-radius: var(--sc-radius-sm);
  padding: var(--sc-space-1);
}
</style>
