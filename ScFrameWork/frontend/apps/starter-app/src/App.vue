<template>
  <sc-app-shell
    application-title="ScFramework"
    application-label="Starter"
    :navigation-label="t('app.navigation')"
    :labels="shellLabels"
    :navigation-items="navigationItems"
    :active-item="activeItem"
    @navigate="navigateToPage"
  >
    <template #header-actions>
      <sc-select
        :model-value="locale"
        label="언어 / Language"
        :options="localeOptions"
        presentation="toolbar"
        density="compact"
        @update:model-value="changeLocale"
      />
      <sc-action-button
        v-if="showOperations && runtime.session.identity"
        variant="text"
        :busy="loggingOut"
        @click="logout"
      >
        {{ t("app.logout") }}
      </sc-action-button>
    </template>
    <template #sidebar-footer>
      <p>{{ t("app.footer") }}</p>
    </template>
    <template v-if="logoutError" #notice>
      <v-alert type="error" role="alert">{{ logoutError }}</v-alert>
    </template>
    <router-view />
  </sc-app-shell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useLocale } from "vuetify";
import { patternsEnabled } from "./config";
import { useRoute } from "vue-router";
import { ScActionButton, ScAppShell, ScSelect, type ScAppShellNavItem } from "@sc/ui";
import { useFrameworkRuntime } from "@sc/runtime";
import { useOperationsAccess } from "./features/operations/capabilities";

const runtime = useFrameworkRuntime();
const operations = useOperationsAccess();
const showOperations = computed(
  () => operations.messaging.value || operations.scheduler.value || operations.browserErrors.value,
);
const loggingOut = ref(false);
const logoutError = ref("");
const { t, locale } = useI18n({ useScope: "global" });
const localeOptions = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
];
function changeLocale(value: string | null) {
  if (value === "ko" || value === "en") locale.value = value;
}
const { current: vuetifyLocale } = useLocale();
watch(
  locale,
  (value) => {
    vuetifyLocale.value = value;
    document.documentElement.lang = value;
  },
  { immediate: true },
);
const shellLabels = computed(() => ({
  skipContent: t("common.shell.skipToContent"),
  openNavigation: t("common.shell.openNavigation"),
  closeNavigation: t("common.shell.closeNavigation"),
}));
const route = useRoute();
const navigationItems = computed<ScAppShellNavItem[]>(() => [
  { id: "start", label: t("app.start"), href: "/" },
  ...(patternsEnabled ? [{ id: "patterns", label: t("app.patterns"), href: "/patterns" }] : []),
  ...(showOperations.value
    ? [
        {
          id: "operations",
          label: t("app.operations"),
          href: operations.messaging.value
            ? "/operations/messages"
            : operations.scheduler.value
              ? "/operations/schedules"
              : "/operations/browser-errors",
        },
      ]
    : []),
]);
const activeItem = computed(() =>
  typeof route.name === "string"
    ? route.name.startsWith("operations-")
      ? "operations"
      : route.name
    : "",
);

async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  logoutError.value = "";
  try {
    await runtime.auth.logout();
    await runtime.router.replace("/");
  } catch (cause) {
    logoutError.value = cause instanceof Error ? cause.message : t("app.logout");
  } finally {
    loggingOut.value = false;
  }
}

async function navigateToPage(item: ScAppShellNavItem) {
  await runtime.router.push(item.href);
}
</script>
