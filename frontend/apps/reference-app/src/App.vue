<template>
  <v-app v-if="route.name === 'login'" class="sc-app"><router-view /></v-app>
  <sc-app-shell
    v-else
    application-title="ScFramework"
    :application-label="t('app.reference')"
    :navigation-label="t('app.navigation')"
    :labels="shellLabels"
    :navigation-items="navigationItems"
    :active-item="activeItem"
    @navigate="navigateToPage"
  >
    <template #header-leading>
      <form
        class="app-search"
        role="search"
        :aria-label="words.search"
        @submit.prevent="openFirstSearchResult"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="mdiMagnify" /></svg>
        <input
          ref="searchInput"
          v-model="menuSearch"
          type="search"
          :aria-label="words.search"
          :aria-controls="searchResultsId"
          :placeholder="words.searchPlaceholder"
          autocomplete="off"
          maxlength="80"
          @focus="openSearchResults"
          @input="openSearchResults"
          @keydown.esc.prevent="closeSearchResults"
          @keydown.down.prevent="focusFirstSearchResult"
        />
        <section
          v-show="searchOpen && menuSearch.trim()"
          :id="searchResultsId"
          ref="searchResults"
          class="app-search-results"
          :style="searchPosition"
          :aria-label="words.searchResults"
          @keydown.esc.prevent="dismissSearchResults"
        >
          <p class="app-search-results__summary" role="status">
            {{
              menuMatches.length
                ? `${words.searchResults} · ${menuMatches.length}`
                : words.noResults
            }}
          </p>
          <ul>
            <li v-for="item in menuMatches" :key="item.id">
              <a :href="item.href" @click="selectSearchResult($event, item)">
                <svg v-if="item.iconPath" viewBox="0 0 24 24" aria-hidden="true">
                  <path :d="item.iconPath" />
                </svg>
                <span>{{ item.label }}</span>
              </a>
            </li>
          </ul>
        </section>
      </form>
    </template>
    <template #header-actions>
      <sc-select
        presentation="toolbar"
        density="compact"
        label="언어 / Language"
        :model-value="locale"
        :options="languageOptions"
        @update:model-value="changeLanguage"
      />
      <template v-if="runtime.session.identity">
        <sc-action-button
          class="app-user-trigger"
          size="lg"
          intent="neutral"
          variant="text"
          type="button"
          :popovertarget="userMenuId"
          :title="words.openUserMenu"
          aria-haspopup="dialog"
          :aria-expanded="userMenuOpen"
          :aria-controls="userMenuId"
          @click="positionUserMenu"
        >
          <span class="app-visually-hidden">{{ words.openUserMenu }}:</span>
          <span class="app-user-avatar" aria-hidden="true">{{ identityInitial }}</span>
          <span class="app-user-name">{{ identityName }}</span>
          <svg class="app-user-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path :d="mdiChevronDown" />
          </svg>
        </sc-action-button>
        <div
          :id="userMenuId"
          ref="userMenu"
          class="app-user-menu"
          popover="auto"
          role="dialog"
          :aria-label="words.userMenu"
          :style="userMenuPosition"
          @toggle="syncUserMenuState"
        >
          <div class="app-user-menu__identity">
            <span class="app-user-avatar" aria-hidden="true">{{ identityInitial }}</span>
            <div>
              <strong>{{ identityName }}</strong>
              <p>{{ runtime.session.identity.username }}</p>
              <small>{{ identityRole }}</small>
            </div>
          </div>
          <div class="app-user-menu__actions">
            <sc-action-button variant="text" @click="openAccount">
              {{ t("app.account") }}
            </sc-action-button>
            <sc-action-button variant="text" :busy="loggingOut" @click="logoutUser">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="mdiLogout" /></svg>
              {{ t("app.logout") }}
            </sc-action-button>
          </div>
        </div>
      </template>
    </template>
    <template #sidebar-footer>
      <p class="app-footer">
        <strong>ScFramework</strong>
        <span>{{ words.workspace }}</span>
      </p>
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
 * ScAppShell의 이름 있는 slot에 상단 도구/사용자 메뉴/공지 영역을 넣고, router-view로 선택한 업무 화면을 표시한다.
 * @navigate는 자식 이벤트를 Router 이동으로 연결한다. 메뉴를 숨기는 것은 화면 표시이며 서버 API 권한 검사를 대신하지 않는다.
 */

/**
 * Reference 앱의 최상위 화면 틀: 공통 ScAppShell에 업무별 메뉴·검색·사용자 도구를 전달한다.
 * JSP의 공통 레이아웃 include와 비슷하지만, router-view 내부 화면만 Router가 교체하고 이 컴포넌트의 상태는 유지한다.
 * 로그인 사용자 원본은 runtime.session, 현재 URL은 useRoute다. 메뉴·활성 항목·표시 이름은 computed로 파생한다.
 * ref는 검색어/팝업처럼 이 화면이 소유한 임시 UI 상태다. script에서는 .value, template에서는 최상위 ref를 자동으로 해제한다.
 */

import { computed, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useLocale } from "vuetify";
import { VApp } from "vuetify/components";
import { useRoute } from "vue-router";
import { useEventListener } from "@vueuse/core";
import {
  mdiViewDashboardOutline,
  mdiFormatListBulletedSquare,
  mdiFileDocumentOutline,
  mdiChartBoxOutline,
  mdiPlusBoxOutline,
  mdiImageMultipleOutline,
  mdiViewColumnOutline,
  mdiBullhornOutline,
  mdiTextBoxOutline,
  mdiWidgetsOutline,
  mdiShieldAccountOutline,
  mdiAccountCircleOutline,
  mdiCogOutline,
  mdiMagnify,
  mdiLogout,
  mdiChevronDown,
} from "@mdi/js";
import { ScActionButton, ScSelect, ScAppShell, type ScAppShellNavItem } from "@sc/ui";
import { useReferenceRuntime } from "./auth/identity";
import { useOperationsAccess } from "./features/operations/capabilities";

const runtime = useReferenceRuntime();
const operations = useOperationsAccess();
const { t, locale } = useI18n({ useScope: "global" });
const { current: vuetifyLocale } = useLocale();
const route = useRoute();
const languageOptions = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
];
function changeLanguage(value: string | null) {
  if (value === "ko" || value === "en") locale.value = value;
}

const words = computed(() =>
  locale.value === "ko"
    ? {
        dashboards: "대시보드",
        workspace: "업무",
        components: "공통 UI",
        admin: "관리",
        search: "메뉴 검색",
        searchPlaceholder: "메뉴를 검색하세요...",
        searchResults: "검색 결과",
        noResults: "일치하는 메뉴가 없습니다.",
        userMenu: "사용자 메뉴",
        openUserMenu: "사용자 메뉴 열기",
        collapse: "탐색 메뉴 접기",
        expand: "탐색 메뉴 펼치기",
      }
    : {
        dashboards: "DASHBOARDS",
        workspace: "WORKSPACE",
        components: "COMPONENTS",
        admin: "ADMIN",
        search: "Search menus",
        searchPlaceholder: "Search for menus...",
        searchResults: "Search results",
        noResults: "No matching menus.",
        userMenu: "User menu",
        openUserMenu: "Open user menu",
        collapse: "Collapse navigation",
        expand: "Expand navigation",
      },
);
/**
 * 앱 번역 locale이 바뀔 때 Vuetify 문구와 HTML lang도 맞춘다. computed와 달리 watch는 외부 상태를 바꾸는 부수 효과에 사용한다.
 */
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
  collapseNavigation: words.value.collapse,
  expandNavigation: words.value.expand,
}));
const loggingOut = ref(false);
const logoutError = ref("");
/**
 * 사용자/역할/서버 capability를 읽어 메뉴 배열을 재계산한다. 배열 spread(...)는 조건부 메뉴 묶음을 펼치는 JavaScript 문법이다.
 */
const navigationItems = computed<ScAppShellNavItem[]>(() =>
  runtime.session.identity
    ? [
        {
          id: "dashboard",
          label: t("app.dashboard"),
          href: "/dashboard",
          iconPath: mdiViewDashboardOutline,
          groupLabel: words.value.dashboards,
        },
        {
          id: "requests",
          label: t("request.list"),
          href: "/requests",
          iconPath: mdiFileDocumentOutline,
          groupLabel: words.value.workspace,
        },
        {
          id: "requirement-report",
          label: t("report.title"),
          href: "/reports/requirements",
          iconPath: mdiChartBoxOutline,
          groupLabel: words.value.workspace,
        },
        {
          id: "workspace",
          label: t("request.new"),
          href: "/workspace",
          iconPath: mdiPlusBoxOutline,
          groupLabel: words.value.workspace,
        },
        {
          id: "screens",
          label: t("app.screens"),
          href: "/screens",
          iconPath: mdiImageMultipleOutline,
          groupLabel: words.value.workspace,
        },
        {
          id: "kanban",
          label: t("app.kanban"),
          href: "/kanban",
          iconPath: mdiViewColumnOutline,
          groupLabel: words.value.workspace,
        },
        {
          id: "notices",
          label: t("app.notices"),
          href: "/notices",
          iconPath: mdiBullhornOutline,
          groupLabel: words.value.workspace,
        },
        {
          id: "documents",
          label: t("app.documents"),
          href: "/documents",
          iconPath: mdiTextBoxOutline,
          groupLabel: words.value.workspace,
        },
        {
          id: "examples",
          label: t("app.examples"),
          href: "/examples",
          iconPath: mdiFormatListBulletedSquare,
          groupLabel: words.value.components,
        },
        {
          id: "patterns",
          label: t("app.patterns"),
          href: "/patterns",
          iconPath: mdiWidgetsOutline,
          groupLabel: words.value.components,
        },
        ...(runtime.session.identity.role === "ADMIN"
          ? [
              {
                id: "admin",
                label: t("app.admin"),
                href: "/admin/users",
                iconPath: mdiShieldAccountOutline,
                groupLabel: words.value.admin,
              },
            ]
          : []),
        {
          id: "account",
          label: t("app.account"),
          href: "/account",
          iconPath: mdiAccountCircleOutline,
          groupLabel: words.value.admin,
        },
        ...(operations.messaging.value ||
        operations.scheduler.value ||
        operations.browserErrors.value
          ? [
              {
                id: "operations",
                label: t("app.operations"),
                iconPath: mdiCogOutline,
                groupLabel: words.value.admin,
                href: operations.messaging.value
                  ? "/operations/messages"
                  : operations.scheduler.value
                    ? "/operations/schedules"
                    : "/operations/browser-errors",
              },
            ]
          : []),
      ]
    : [{ id: "login", label: t("app.login"), href: "/login" }],
);
const activeItem = computed(() =>
  route.name === "request-detail"
    ? "requests"
    : typeof route.name === "string" && route.name.startsWith("admin-")
      ? "admin"
      : route.name === "notice-detail" || route.name === "notices-new"
        ? "notices"
        : route.name === "document-detail" || route.name === "documents-new"
          ? "documents"
          : typeof route.name === "string"
            ? route.name.startsWith("operations-")
              ? "operations"
              : route.name
            : "",
);

const menuSearch = ref("");
const searchOpen = ref(false);
const searchInput = ref<HTMLInputElement>();
const searchResults = ref<HTMLElement>();
const searchResultsId = `app-menu-search-${useId()}`;
const searchPosition = ref({ top: "68px", left: "16px" });
const menuMatches = computed(() => {
  const query = menuSearch.value.trim().toLocaleLowerCase();
  return query
    ? navigationItems.value.filter((item) => item.label.toLocaleLowerCase().includes(query))
    : [];
});
/**
 * input의 실제 DOM 위치를 읽어 검색 결과 팝업 좌표를 맞춘다. ref<HTMLInputElement>는 값 입력용 ref와 달리 template DOM 참조다.
 */
function openSearchResults() {
  const bounds = searchInput.value?.getBoundingClientRect();
  if (bounds)
    searchPosition.value = {
      top: `${bounds.bottom + 12}px`,
      left: `${Math.max(16, Math.min(bounds.left, window.innerWidth - 356))}px`,
    };
  searchOpen.value = true;
}
function closeSearchResults() {
  searchOpen.value = false;
}
function dismissSearchResults() {
  searchInput.value?.focus();
  closeSearchResults();
}
function focusFirstSearchResult() {
  searchResults.value?.querySelector<HTMLAnchorElement>("a")?.focus();
}
async function navigateToPage(item: ScAppShellNavItem) {
  return runtime.router.push(item.href);
}
/**
 * 라우트 이탈 가드가 이동을 취소할 수 있으므로 Router 결과를 기다린다. 이동이 성립한 경우에만 검색 초안을 비운다.
 */
async function activateSearchResult(item: ScAppShellNavItem) {
  const failure = await navigateToPage(item);
  // 이탈 확인을 취소했을 때는 검색어와 작성 중인 업무 입력을 그대로 둔다.
  if (!failure || route.path === item.href) {
    closeSearchResults();
    menuSearch.value = "";
  }
}
/**
 * 수정키/다른 마우스 버튼은 브라우저 링크의 기본 동작을 유지한다. 일반 클릭만 SPA Router가 처리하도록 기본 이동을 막는다.
 */
function selectSearchResult(event: MouseEvent, item: ScAppShellNavItem) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  void activateSearchResult(item);
}
async function openFirstSearchResult() {
  if (menuMatches.value[0]) await activateSearchResult(menuMatches.value[0]);
}
/**
 * VueUse가 화면 수명에 맞춰 이벤트 리스너를 정리한다. 창 크기 변경 후 열려 있는 팝업의 위치만 다시 계산한다.
 */
useEventListener(window, "resize", () => {
  if (searchOpen.value) openSearchResults();
});
useEventListener(document, "pointerdown", (event) => {
  if (event.target instanceof Node && !searchInput.value?.form?.contains(event.target))
    closeSearchResults();
});

const identityName = computed(
  () => runtime.session.identity?.displayName || runtime.session.identity?.username || "",
);
const identityInitial = computed(() =>
  Array.from(identityName.value.trim()).slice(0, 1).join("").toLocaleUpperCase(),
);
const identityRole = computed(() => {
  const role = runtime.session.identity?.role;
  if (locale.value !== "ko")
    return role === "ADMIN" ? "Administrator" : role === "REVIEWER" ? "Reviewer" : "Requester";
  return role === "ADMIN" ? "관리자" : role === "REVIEWER" ? "검토자" : "작성자";
});
const userMenuId = `app-user-menu-${useId()}`;
const userMenu = ref<HTMLDivElement>();
const userMenuOpen = ref(false);
const userMenuPosition = ref({ top: "68px", right: "16px" });
function positionUserMenu(event: MouseEvent) {
  if (!(event.currentTarget instanceof HTMLElement)) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  userMenuPosition.value = {
    top: `${bounds.bottom + 12}px`,
    right: `${Math.max(16, window.innerWidth - bounds.right)}px`,
  };
}
/**
 * 브라우저 native popover의 실제 열림 상태를 Vue 상태에 반영하여 aria-expanded와 표시가 어긋나지 않게 한다.
 */
function syncUserMenuState() {
  userMenuOpen.value = userMenu.value?.matches(":popover-open") ?? false;
}
async function openAccount() {
  const failure = await runtime.router.push("/account");
  if (!failure || route.path === "/account") userMenu.value?.hidePopover();
}
/**
 * 공통 auth가 서버 세션을 종료하고 캐시/클라이언트 세대를 정리한 뒤 로그인 URL로 교체한다. 중복 클릭과 실패 표시를 이 화면이 담당한다.
 */
async function logoutUser() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  logoutError.value = "";
  try {
    await runtime.auth.logout();
    await runtime.router.replace("/login");
  } catch (cause) {
    logoutError.value = cause instanceof Error ? cause.message : "로그아웃하지 못했습니다.";
  } finally {
    loggingOut.value = false;
  }
}
</script>

<style scoped lang="scss">
@use "@sc/ui/tokens" with (
  $sc-emit-css: false
);
.app-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.app-search {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  height: 36px;
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-sm);
  background: var(--sc-color-surface);
}
.app-search:focus-within {
  outline: 2px solid var(--sc-color-focus);
  outline-offset: 2px;
}
.app-search > svg {
  order: 1;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  margin-right: 12px;
  fill: var(--sc-color-text-muted);
}
.app-search input {
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 8px 8px 8px 12px;
  border: 0;
  border-radius: inherit;
  color: var(--sc-color-text);
  background: transparent;
  font: inherit;
  font-size: 13px;
}
.app-search input:focus-visible {
  outline: none;
}
.app-search input::placeholder {
  color: var(--sc-color-text-muted);
  opacity: 1;
}
.app-search-results {
  position: fixed;
  z-index: 40;
  width: min(340px, calc(100vw - 32px));
  max-height: min(480px, calc(100dvh - 100px));
  overflow: auto;
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
  background: var(--sc-color-surface);
  box-shadow: var(--sc-shadow-overlay);
}
.app-search-results__summary {
  margin: 0;
  padding: 12px 16px;
  color: var(--sc-color-text-muted);
  font-size: 12px;
  border-bottom: 1px solid var(--sc-color-border);
}
.app-search-results ul {
  list-style: none;
  margin: 0;
  padding: 8px;
}
.app-search-results a {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 8px 12px;
  color: var(--sc-color-text);
  border-radius: var(--sc-radius-sm);
  text-decoration: none;
}
.app-search-results a:hover {
  background: var(--sc-color-surface-muted);
}
.app-search-results svg,
.app-user-trigger svg,
.app-user-menu__actions svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: currentColor;
}
.app-user-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: var(--sc-radius-sm);
  background: color-mix(in srgb, var(--sc-color-primary) 12%, var(--sc-color-surface));
  color: var(--sc-color-primary);
  font-size: 15px;
  font-weight: 700;
}
.app-user-name {
  max-width: 100px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
}
.app-user-menu {
  position: fixed;
  z-index: 50;
  inset: auto;
  margin: 0;
  width: min(280px, calc(100vw - 32px));
  padding: 16px;
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
  background: var(--sc-color-surface);
  color: var(--sc-color-text);
  box-shadow: var(--sc-shadow-overlay);
}
.app-user-menu__identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--sc-color-border);
  overflow-wrap: anywhere;
}
.app-user-menu__identity p {
  margin: 2px 0;
  color: var(--sc-color-text-muted);
  font-size: 12px;
}
.app-user-menu__identity small {
  color: var(--sc-color-text-muted);
}
.app-user-menu__actions {
  display: grid;
  gap: 4px;
  margin-top: 12px;
}
.app-footer {
  display: grid;
  gap: 4px;
  margin: 0;
  font-size: 11px;
}
.app-footer strong {
  color: var(--sc-color-nav-text);
  font-weight: 500;
}
@media (max-width: calc(tokens.$sc-breakpoint-sm - 1px)) {
  .app-user-name,
  .app-user-chevron {
    display: none;
  }
  .app-search > svg {
    margin-right: 8px;
  }
  .app-search input {
    padding-right: 4px;
  }
}
</style>
