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
      <sc-select
        :model-value="locale"
        label="언어 / Language"
        :options="localeOptions"
        presentation="toolbar"
        density="compact"
        @update:model-value="changeLocale"
      />
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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * #header-actions는 언어/로그아웃 도구, #sidebar-footer는 설명 영역이다. @navigate를 Router 이동에 연결한다.
 */

/**
 * 생성 앱의 공통 shell 조립자다. Notes와 선택 패턴/운영 메뉴를 현재 세션/capability에서 계산한다.
 * props/slot으로 공통 ScAppShell을 소비하며 실제 업무 화면은 router-view가 교체한다. 언어 변경은 Vuetify와 HTML lang에도 반영한다.
 * 로그아웃은 공통 auth로 서버 세션과 브라우저 캐시를 정리한 뒤 로그인 URL로 이동한다.
 */

import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocale } from "vuetify";
import { ScAppShell, ScActionButton, ScSelect, type ScAppShellNavItem } from "@sc/ui";
import { useFrameworkRuntime } from "@sc/runtime";
import { patternsEnabled } from "./config";
import { useOperationsAccess } from "./features/operations/capabilities";
const runtime = useFrameworkRuntime();
const operations = useOperationsAccess();
const operationsEnabled = computed(
  () => operations.messaging.value || operations.scheduler.value || operations.browserErrors.value,
);
const route = useRoute();
const { t, locale } = useI18n({ useScope: "global" });
const localeOptions = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
];
function changeLocale(value: string | null) {
  if (value === "ko" || value === "en") locale.value = value;
}
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
        ...(operationsEnabled.value
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
      ]
    : [],
);
const activeItem = computed(() =>
  typeof route.name === "string"
    ? route.name.startsWith("operations-")
      ? "operations"
      : route.name
    : "",
);
async function navigateToPage(item: ScAppShellNavItem) {
  await runtime.router.push(item.href);
}
async function signOut() {
  await runtime.auth.logout();
  await runtime.router.replace("/login");
}
</script>
