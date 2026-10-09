<template>
  <nav
    class="sc-shell-navigation"
    :class="{ 'sc-shell-navigation--collapsed': collapsed }"
    :aria-label="label"
  >
    <div v-for="group in groups" :key="group.key" class="sc-shell-navigation__group">
      <p class="sc-shell-navigation__label">{{ group.label }}</p>
      <ul class="sc-shell-navigation__list">
        <li v-for="item in group.items" :key="item.id">
          <a
            :href="item.href"
            class="sc-shell-navigation__link"
            :aria-current="item.id === activeItem ? 'page' : undefined"
            :title="collapsed ? item.label : undefined"
            @click="selectItem($event, item)"
          >
            <svg
              v-if="item.iconPath"
              class="sc-shell-navigation__icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path :d="item.iconPath" />
            </svg>
            <span v-else class="sc-shell-navigation__initial" aria-hidden="true">
              {{ item.label.slice(0, 1) }}
            </span>
            <span class="sc-shell-navigation__text">{{ item.label }}</span>
          </a>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 연속된 메뉴 그룹을 nav/ul/li/a로 표시한다. 실제 href를 남겨 새 탭 열기·주소 복사 같은 브라우저 기능을 유지한다.
 * activeItem이 같은 링크만 aria-current=page가 되고 접힘 상태에서는 title로 메뉴 이름을 보완한다.
 */

/*
 * ScAppShell 내부 탐색 부품이다. props.items는 이미 앱이 권한/기능에 맞게 만든 메뉴이며 여기서 필터링 정책을 결정하지 않는다.
 *  computed는 연속된 groupLabel을 표시용 그룹으로 묶는다. 원본 항목 객체와 메뉴 순서는 보존한다.
 *  일반 클릭만 navigate emit으로 부모에게 전달해 Router 연결을 허용하고 수정키 클릭은 native href 동작으로 남긴다.
 */
import { computed } from "vue";
import type { ScAppShellNavItem } from "./types";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  label: string;
  items: readonly ScAppShellNavItem[];
  activeItem: string;
  collapsed?: boolean;
}>();

const groups = computed(() => {
  const result: { key: string; label: string; items: ScAppShellNavItem[] }[] = [];
  for (const item of props.items) {
    const label = item.groupLabel ?? props.label;
    const previous = result.at(-1);
    // 표시용 그룹을 만들되 기존 항목 객체와 메뉴 순서는 보존한다.
    if (previous?.label === label) previous.items.push(item);
    else result.push({ key: item.id, label, items: [item] });
  }
  return result;
});

const emit = defineEmits<{ navigate: [item: ScAppShellNavItem] }>();

// event.preventDefault는 일반 좌클릭에서만 호출한다. Ctrl/Meta/Shift/Alt를 사용한 링크 행동을 SPA 라우팅으로 가로채지 않는다.
function selectItem(event: MouseEvent, item: ScAppShellNavItem) {
  // 새 탭 열기 같은 브라우저 동작은 유지하고 일반 선택만 앱의 Router에 전달한다.
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
  emit("navigate", item);
}
</script>

<style scoped lang="scss">
.sc-shell-navigation {
  display: grid;
  gap: var(--sc-space-6);
}

.sc-shell-navigation__label {
  margin: 0 0 var(--sc-space-4);
  padding-inline: 28px var(--sc-space-4);
  color: var(--sc-shell-nav-muted, var(--sc-color-text-muted));
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  line-height: 1.6;
  text-transform: uppercase;
}

.sc-shell-navigation__list {
  display: grid;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.sc-shell-navigation__link {
  display: flex;
  align-items: center;
  gap: var(--sc-space-3);
  min-height: 44px;
  padding: var(--sc-space-2) var(--sc-space-4) var(--sc-space-2) 22px;
  border-radius: 0 24px 24px 0;
  color: var(--sc-shell-nav-text, var(--sc-color-text));
  font-size: 13px;
  font-weight: 500;
  line-height: var(--sc-line-height-body);
  overflow-wrap: anywhere;
  text-decoration: none;
}

.sc-shell-navigation__link:hover {
  background: var(--sc-shell-nav-hover, var(--sc-color-surface-muted));
}

.sc-shell-navigation__link[aria-current="page"] {
  background: var(--sc-shell-nav-active, var(--sc-color-selected));
  color: var(--sc-shell-nav-active-text, var(--sc-color-on-selected));
  font-weight: 600;
}

.sc-shell-navigation__link:focus-visible {
  outline: 3px solid var(--sc-shell-nav-focus, var(--sc-color-focus));
  outline-offset: -3px;
}

.sc-shell-navigation__icon,
.sc-shell-navigation__initial {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
}

.sc-shell-navigation__icon {
  fill: currentColor;
}

.sc-shell-navigation__initial {
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 600;
}

.sc-shell-navigation__text {
  min-width: 0;
}

.sc-shell-navigation--collapsed {
  gap: var(--sc-space-4);
}

.sc-shell-navigation--collapsed .sc-shell-navigation__label,
.sc-shell-navigation--collapsed .sc-shell-navigation__text {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.sc-shell-navigation--collapsed .sc-shell-navigation__link {
  justify-content: center;
  padding-inline: var(--sc-space-3);
  border-radius: var(--sc-radius-md);
}
</style>
