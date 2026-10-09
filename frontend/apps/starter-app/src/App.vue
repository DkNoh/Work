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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * #header-actions/#sidebar-footer/#notice는 ScAppShell이 제공하는 삽입 위치다. @navigate 이벤트를 받아 Router로 이동한다.
 */

/**
 * Starter의 최상위 공통 shell 조립자다. 업무 데이터 대신 탐색/언어/로그아웃 UI를 소유하고 router-view에 현재 화면을 배치한다.
 * 메뉴와 활성 항목은 URL/capability에서 computed로 계산한다. 운영 기능이 켜진 경우에만 해당 메뉴를 보여준다.
 * locale watch는 Vue i18n·Vuetify·HTML lang을 동기화한다. API를 호출하는 로그아웃은 공통 runtime.auth를 경유한다.
 */

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

/**
 * 중복 로그아웃을 막고 실패를 shell notice에 표시한다. 성공 시 공통 auth의 세션/캐시 정리 후 공개 시작 화면으로 이동한다.
 */
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
