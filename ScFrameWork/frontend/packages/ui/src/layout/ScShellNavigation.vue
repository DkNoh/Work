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
  margin: 0 0 var(--sc-space-2);
  padding-inline: var(--sc-space-4);
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
  padding: var(--sc-space-2) var(--sc-space-4);
  border-radius: 24px;
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
  outline-offset: 3px;
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
