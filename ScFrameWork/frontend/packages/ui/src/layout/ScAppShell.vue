<template>
  <v-app class="sc-app">
    <div
      v-bind="shellAttrs()"
      class="sc-app-shell"
      :class="{ 'sc-app-shell--collapsed': desktopCollapsed }"
      :style="{ '--sc-shell-header-height': `${headerHeight}px` }"
      @focusin="rememberFocus"
    >
      <a
        ref="skipLink"
        class="sc-app-shell__skip"
        :href="`#${contentId}`"
        @click.prevent="focusContent"
      >
        {{ shellLabels.skipContent }}
      </a>
      <header ref="header" class="sc-app-shell__header">
        <div class="sc-app-shell__brand">
          <span class="sc-app-shell__brand-mark" aria-hidden="true">Sc</span>
          <div class="sc-app-shell__brand-text">
            <p class="sc-app-shell__title">{{ applicationTitle }}</p>
            <p v-if="applicationLabel" class="sc-app-shell__subtitle">{{ applicationLabel }}</p>
          </div>
        </div>
        <div class="sc-app-shell__toolbar">
          <button
            ref="navigationTrigger"
            class="sc-app-shell__menu-toggle"
            type="button"
            :aria-label="navigationToggleLabel"
            :aria-haspopup="desktopViewport ? undefined : 'dialog'"
            :aria-expanded="desktopViewport ? !desktopCollapsed : navigationOpen"
            :aria-controls="desktopViewport ? sidebarId : dialogId"
            @click="toggleNavigation"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div v-if="$slots['header-leading']" class="sc-app-shell__header-leading">
            <slot name="header-leading" />
          </div>
          <div v-if="$slots['header-actions']" class="sc-app-shell__header-actions">
            <slot name="header-actions" />
          </div>
        </div>
      </header>

      <div ref="backgroundBody" class="sc-app-shell__body">
        <aside :id="sidebarId" ref="desktopNavigation" class="sc-app-shell__sidebar">
          <sc-shell-navigation
            :label="navigationLabel"
            :items="navigationItems"
            :active-item="activeItem"
            :collapsed="desktopCollapsed"
            @navigate="selectNavigation"
          />
          <div v-if="$slots['sidebar-footer']" class="sc-app-shell__sidebar-footer">
            <slot name="sidebar-footer" />
          </div>
        </aside>
        <main :id="contentId" ref="content" class="sc-app-shell__content" tabindex="-1">
          <div v-if="$slots.notice" class="sc-app-shell__notice"><slot name="notice" /></div>
          <slot />
        </main>
      </div>

      <dialog
        :id="dialogId"
        ref="navigationDialog"
        class="sc-app-shell__dialog"
        :aria-label="navigationLabel"
        aria-modal="true"
        @close="navigationOpen = false"
        @click="closeOnBackdrop"
        @keydown.esc.prevent="closeNavigation"
        @keydown.tab="keepFocusInNavigation"
      >
        <div class="sc-app-shell__dialog-header">
          <strong>{{ applicationTitle }}</strong>
          <button
            class="sc-app-shell__dialog-close"
            type="button"
            :aria-label="shellLabels.closeNavigation"
            @click="closeNavigation"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <sc-shell-navigation
          :label="navigationLabel"
          :items="navigationItems"
          :active-item="activeItem"
          @navigate="selectNavigation"
        />
      </dialog>
    </div>
  </v-app>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 상단 header·데스크톱 sidebar·단일 main·모바일 navigation dialog를 조립한다. header/footer/notice/default slot은 소비 앱의 화면 조각이다.
 * 본문 바로가기 링크는 main에 포커스를 옮긴다. 메뉴 버튼은 넓은 화면에서 접기, 좁은 화면에서 modal 열기로 동작한다.
 */

/*
 * 업무 앱의 공통 바깥 틀이다. 메뉴 항목/현재 route/번역 문구는 부모 props이고 Router·세션·권한 자체는 import하지 않는다.
 *  로컬 ref는 DOM 참조와 메뉴 열림/접힘/viewport 상태다. computed는 현재 상태에 맞는 버튼의 접근성 문구를 만든다.
 *  watch와 lifecycle hook은 native dialog·미디어 질의·ResizeObserver처럼 Vue template만으로 끝나지 않는 브라우저 효과를 관리한다.
 */
import { computed, onMounted, onBeforeUnmount, ref, useAttrs, useId, watch } from "vue";
import { VApp } from "vuetify/components";
import ScShellNavigation from "./ScShellNavigation.vue";
import { uiTokens } from "../tokens";
import { pickScHtmlAttrs } from "../contracts";
import type { ScAppShellNavItem, ScAppShellProps, ScAppShellEmits, ScAppShellSlots } from "./types";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScAppShellProps>(), {
  applicationLabel: "",
  navigationLabel: "화면 탐색",
  labels: () => ({}),
});

// 기본 한국어에 앱 문구를 합친다. locale 원본을 여기 저장하지 않아 부모 언어 변경이 모든 메뉴 문구에 바로 반영된다.
const shellLabels = computed(() => ({
  skipContent: "본문으로 이동",
  openNavigation: "탐색 메뉴 열기",
  closeNavigation: "탐색 메뉴 닫기",
  ...props.labels,
  collapseNavigation: props.labels.collapseNavigation ?? "탐색 메뉴 접기",
  expandNavigation: props.labels.expandNavigation ?? "탐색 메뉴 펼치기",
}));

const emit = defineEmits<ScAppShellEmits>();
defineSlots<ScAppShellSlots>();
const attrs = useAttrs();
const domEvents = [
  "onClick",
  "onDblclick",
  "onAuxclick",
  "onContextmenu",
  "onFocus",
  "onBlur",
  "onFocusin",
  "onFocusout",
  "onKeydown",
  "onKeyup",
] as const;

function shellAttrs() {
  // 공개 HTML 속성만 실제 셸 div로 전달하고 Vuetify 내부 props는 노출하지 않는다.
  return pickScHtmlAttrs(attrs, {
    attributes: [
      "id",
      "accesskey",
      "autocapitalize",
      "autocorrect",
      "contenteditable",
      "draggable",
      "enterkeyhint",
      "hidden",
      "inert",
      "inputmode",
      "spellcheck",
      "translate",
    ],
    events: [...domEvents, ...domEvents.map((name) => `${name}Capture`)],
  });
}

// 같은 문서에 여러 앱/Story가 있어도 본문·sidebar·dialog의 ID가 겹치지 않게 인스턴스 ID를 공유 접두사로 사용한다.
const instanceId = useId();
const contentId = `sc-content-${instanceId}`;
const dialogId = `sc-navigation-${instanceId}`;
const sidebarId = `sc-sidebar-${instanceId}`;
const content = ref<HTMLElement>();
const header = ref<HTMLElement>();
const headerHeight = ref<number>(uiTokens.layout.headerHeight);
const navigationDialog = ref<HTMLDialogElement>();
const desktopNavigation = ref<HTMLElement>();
const navigationTrigger = ref<HTMLButtonElement>();
const navigationOpen = ref(false);
const desktopCollapsed = ref(false);
const desktopViewport = ref(false);
const navigationToggleLabel = computed(() =>
  desktopViewport.value
    ? desktopCollapsed.value
      ? shellLabels.value.expandNavigation
      : shellLabels.value.collapseNavigation
    : shellLabels.value.openNavigation,
);
let focusWasInDesktopNavigation = false;
let desktopMedia: MediaQueryList | undefined;
const skipLink = ref<HTMLAnchorElement>();
const backgroundBody = ref<HTMLElement>();
// 모바일 모달이 열리면 배경은 조작·낭독 대상에서 빠지고, 닫기 전에 복원한다.
// 동기 갱신으로 native dialog.close()의 트리거 포커스 복귀를 막지 않는다.
watch(
  navigationOpen,
  (open) => {
    for (const element of [skipLink.value, header.value, backgroundBody.value]) {
      if (!element) continue;
      element.inert = open;
      if (open) element.setAttribute("aria-hidden", "true");
      else element.removeAttribute("aria-hidden");
    }
  },
  { flush: "sync" },
);
let headerObserver: ResizeObserver | undefined;

// 실제 header 높이를 CSS 변수로 보낸다. 긴 제목/계정 영역으로 높이가 커져도 고정 sidebar가 header와 겹치지 않는다.
function measureHeader() {
  headerHeight.value = Math.max(
    uiTokens.layout.headerHeight,
    header.value?.getBoundingClientRect().height ?? uiTokens.layout.headerHeight,
  );
}

function focusContent() {
  content.value?.focus();
}

function openNavigation() {
  // native dialog가 Tab 범위·Escape·배경 inert·닫은 뒤 포커스 복귀를 관리한다.
  navigationDialog.value?.showModal();
  navigationOpen.value = true;
}

function toggleNavigation() {
  if (desktopViewport.value) desktopCollapsed.value = !desktopCollapsed.value;
  else openNavigation();
}

function closeNavigation() {
  navigationOpen.value = false;
  navigationDialog.value?.close();
}

// 현재 보이는 활성 메뉴 컨트롤만 모아 Tab 양끝을 순환시킨다. modal을 닫기 전까지 배경 화면으로 포커스가 새지 않게 한다.
function keepFocusInNavigation(event: KeyboardEvent) {
  const dialog = navigationDialog.value;
  if (!dialog?.open) return;
  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden",
  );
  const first = controls[0];
  const last = controls.at(-1);
  // native dialog의 배경 inert를 유지하며 양 끝 Tab도 메뉴 안에서 순환시킨다.
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function closeOnBackdrop(event: MouseEvent) {
  const dialog = navigationDialog.value;
  if (!dialog || event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    closeNavigation();
}

// 선택 의도만 부모에게 전달한다. 실제 router.push와 미저장 입력 guard는 소비 앱이 결정해야 공통 셸이 업무 로직에 결합되지 않는다.
function selectNavigation(item: ScAppShellNavItem) {
  closeNavigation();
  emit("navigate", item);
}

function rememberFocus(event: FocusEvent) {
  focusWasInDesktopNavigation =
    event.target instanceof Node && !!desktopNavigation.value?.contains(event.target);
}

// 화면 폭이 바뀌며 기존 탐색 DOM이 숨겨질 때 사용자가 포커스를 잃지 않게 새로 보이는 메뉴/트리거로 이동한다.
function adjustNavigationForViewport(event: MediaQueryListEvent) {
  desktopViewport.value = event.matches;
  if (!event.matches) {
    // CSS로 탐색이 숨겨지며 body로 포커스가 돌아가는 경우에도 마지막 탐색 위치를 보존한다.
    if (focusWasInDesktopNavigation) navigationTrigger.value?.focus();
    return;
  }
  if (!navigationOpen.value) return;
  closeNavigation();
  // 데스크톱 탐색이 나타나면 닫힌 dialog 대신 현재 탐색 링크로 포커스를 옮긴다.
  const currentLink =
    desktopNavigation.value?.querySelector<HTMLAnchorElement>('[aria-current="page"]');
  (currentLink ?? content.value)?.focus();
}

// browser DOM이 준비된 뒤 폭/높이 관찰을 시작한다. 반응형 CSS 기준도 uiTokens.breakpoint와 같은 원본을 사용한다.
onMounted(() => {
  desktopMedia = window.matchMedia(`(min-width: ${uiTokens.breakpoint.sm}px)`);
  desktopViewport.value = desktopMedia.matches;
  desktopMedia.addEventListener("change", adjustNavigationForViewport);
  measureHeader();
  if (header.value) {
    // 긴 제목·계정 영역·폭 변화로 높이가 달라져도 sticky 탐색은 실제 header 아래에 둔다.
    headerObserver = new ResizeObserver(measureHeader);
    headerObserver.observe(header.value);
  }
});

// 등록한 media listener와 ResizeObserver를 해제하고 열린 modal도 닫는다. 다른 앱/화면으로 이동한 뒤 콜백이 남지 않게 한다.
onBeforeUnmount(() => {
  desktopMedia?.removeEventListener("change", adjustNavigationForViewport);
  headerObserver?.disconnect();
  if (navigationOpen.value) closeNavigation();
});
</script>

<style scoped lang="scss">
@use "../tokens" with (
  $sc-emit-css: false
);

.sc-app-shell {
  --sc-shell-sidebar-width: var(--sc-sidebar-width);

  min-height: 100vh;
  color: var(--sc-color-text);
  background: var(--sc-color-background);
}

.sc-app-shell__skip {
  position: fixed;
  z-index: 100;
  top: var(--sc-space-2);
  left: var(--sc-space-4);
  padding: var(--sc-space-3) var(--sc-space-4);
  border-radius: var(--sc-radius-sm);
  transform: translateY(-200%);
  color: var(--sc-color-on-primary);
  background: var(--sc-color-primary);
  font-weight: 700;
  text-decoration: none;
}

.sc-app-shell__skip:focus {
  transform: translateY(0);
}

.sc-app-shell__header {
  position: sticky;
  z-index: 20;
  top: 0;
  display: grid;
  grid-template-columns: var(--sc-shell-sidebar-width) minmax(0, 1fr);
  align-items: stretch;
  min-height: var(--sc-header-height);
  background: var(--sc-color-surface);
  box-shadow: inset 0 -1px 0 var(--sc-color-border);
}

.sc-app-shell__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sc-space-2);
  min-width: 0;
  padding: var(--sc-space-2) var(--sc-space-4);
  color: var(--sc-color-nav-text);
  background: var(--sc-color-nav-background);
  box-shadow: inset 0 -1px 0 rgb(255 255 255 / 10%);
}

.sc-app-shell__brand-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 50%;
  color: var(--sc-color-nav-text);
  font-size: 14px;
  font-weight: 700;
}

.sc-app-shell__brand-text {
  min-width: 0;
}

.sc-app-shell__title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.sc-app-shell__subtitle {
  margin: 0;
  color: var(--sc-color-nav-muted);
  font-size: 10px;
  line-height: 1.5;
}

.sc-app-shell__toolbar {
  display: flex;
  align-items: center;
  gap: var(--sc-space-1);
  min-width: 0;
  min-height: var(--sc-header-height);
  padding-inline: 0 var(--sc-space-3);
}

.sc-app-shell__header-leading {
  flex: 0 1 320px;
  min-width: 0;
}

.sc-app-shell__header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--sc-space-3);
  margin-left: auto;
}

.sc-app-shell__body {
  display: grid;
  grid-template-columns: var(--sc-shell-sidebar-width) minmax(0, 1fr);
}

.sc-app-shell__sidebar {
  --sc-shell-nav-text: var(--sc-color-nav-muted);
  --sc-shell-nav-muted: var(--sc-color-nav-muted);
  --sc-shell-nav-hover: var(--sc-color-nav-hover);
  --sc-shell-nav-active: var(--sc-color-nav-active);
  --sc-shell-nav-active-text: var(--sc-color-nav-active-text);
  --sc-shell-nav-focus: var(--sc-color-nav-text);

  position: sticky;
  top: var(--sc-shell-header-height);
  display: flex;
  flex-direction: column;
  align-self: start;
  gap: var(--sc-space-6);
  min-height: calc(100vh - var(--sc-shell-header-height));
  max-height: calc(100vh - var(--sc-shell-header-height));
  overflow: auto;
  padding: var(--sc-space-5) var(--sc-space-3) var(--sc-space-5) 0;
  background: var(--sc-color-nav-background);
}

.sc-app-shell__sidebar-footer {
  margin-top: auto;
  padding-inline: 28px var(--sc-space-3);
  color: var(--sc-color-nav-muted);
  font-size: var(--sc-font-size-small);
  line-height: var(--sc-line-height-body);
}

.sc-app-shell__content {
  min-width: 0;
}

.sc-app-shell__notice {
  width: min(100%, var(--sc-content-width));
  margin-inline: auto;
  padding: var(--sc-space-6) var(--sc-space-6) 0;
}

.sc-app-shell__menu-toggle,
.sc-app-shell__dialog-close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
  color: var(--sc-color-text);
  background: var(--sc-color-surface);
  cursor: pointer;
}

.sc-app-shell__menu-toggle {
  border-color: transparent;
  color: var(--sc-color-text-muted);
  background: transparent;
}

.sc-app-shell__menu-toggle svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.sc-app-shell__dialog {
  --sc-shell-nav-text: var(--sc-color-nav-muted);
  --sc-shell-nav-muted: var(--sc-color-nav-muted);
  --sc-shell-nav-hover: var(--sc-color-nav-hover);
  --sc-shell-nav-active: var(--sc-color-nav-active);
  --sc-shell-nav-active-text: var(--sc-color-nav-active-text);
  --sc-shell-nav-focus: var(--sc-color-nav-text);

  inset: 0 auto 0 0;
  width: min(320px, calc(100vw - 48px));
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: var(--sc-space-4) var(--sc-space-3) var(--sc-space-4) 0;
  border: 0;
  color: var(--sc-color-nav-text);
  background: var(--sc-color-nav-background);
}

.sc-app-shell__dialog::backdrop {
  background: rgb(0 0 0 / 35%);
}

.sc-app-shell__dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sc-space-3);
  margin-bottom: var(--sc-space-6);
  padding-left: var(--sc-space-4);
}

.sc-app-shell__dialog-header strong {
  overflow-wrap: anywhere;
}

.sc-app-shell__dialog-close {
  font-size: 1.75rem;
  color: var(--sc-color-nav-text);
  background: transparent;
  border-color: var(--sc-color-nav-muted);
}

.sc-app-shell__skip:focus-visible {
  outline: 3px solid var(--sc-color-on-primary);
  outline-offset: -3px;
}

.sc-app-shell__menu-toggle:focus-visible,
.sc-app-shell__content:focus-visible {
  outline: 3px solid var(--sc-color-focus);
  outline-offset: -3px;
}

.sc-app-shell__dialog-close:focus-visible {
  outline: 3px solid var(--sc-color-nav-text);
  outline-offset: -3px;
}

@media (min-width: tokens.$sc-breakpoint-sm) {
  .sc-app-shell--collapsed {
    --sc-shell-sidebar-width: 80px;
  }

  .sc-app-shell--collapsed .sc-app-shell__brand-text {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .sc-app-shell--collapsed .sc-app-shell__sidebar-footer {
    display: none;
  }

  .sc-app-shell--collapsed .sc-app-shell__sidebar {
    padding-inline: var(--sc-space-3);
  }
}

@media (max-width: calc(tokens.$sc-breakpoint-sm - 1px)) {
  .sc-app-shell__header {
    grid-template-columns: 52px minmax(0, 1fr);
  }

  .sc-app-shell__brand {
    padding-inline: var(--sc-space-2);
  }

  .sc-app-shell__brand-text {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .sc-app-shell__sidebar {
    display: none;
  }

  .sc-app-shell__toolbar {
    gap: var(--sc-space-2);
    padding-inline: var(--sc-space-2);
  }

  .sc-app-shell__header-leading {
    flex: 1 1 0;
  }

  .sc-app-shell__header-actions {
    gap: var(--sc-space-2);
  }

  .sc-app-shell__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .sc-app-shell__notice {
    padding: var(--sc-space-4) var(--sc-space-4) 0;
  }
}
</style>
