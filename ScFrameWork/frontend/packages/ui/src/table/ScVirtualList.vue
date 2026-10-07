<template>
  <div v-bind="listAttrs()" class="sc-virtual-list" :aria-busy="loading || undefined">
    <p v-if="loading" role="status">
      <slot name="loading">{{ text.loading }}</slot>
    </p>
    <div v-if="error" role="alert">
      <slot name="error" :message="error" :retry="retry">
        <p>{{ error }}</p>
        <button type="button" class="sc-table-button" :disabled="loading" @click="retry">
          {{ text.retry }}
        </button>
      </slot>
    </div>
    <p v-if="!loading && !error && !items.length" role="status">
      <slot name="empty">{{ text.empty }}</slot>
    </p>
    <div class="sc-table-toolbar" role="group" :aria-label="label">
      <button
        type="button"
        class="sc-table-button"
        :disabled="!items.length"
        @click="moveRow('first')"
      >
        {{ text.firstRow }}
      </button>
      <button
        type="button"
        class="sc-table-button"
        :disabled="!items.length"
        @click="moveRow('previous')"
      >
        {{ text.previousRow }}
      </button>
      <span role="status">
        {{ text.rowPosition(items.length ? currentIndex() + 1 : 0, items.length) }}
      </span>
      <button
        type="button"
        class="sc-table-button"
        :disabled="!items.length"
        @click="moveRow('next')"
      >
        {{ text.nextRow }}
      </button>
      <button
        type="button"
        class="sc-table-button"
        :disabled="!items.length"
        @click="moveRow('last')"
      >
        {{ text.lastRow }}
      </button>
    </div>
    <div
      ref="viewport"
      class="sc-table-scroll sc-virtual-list__viewport"
      role="region"
      :aria-label="text.listScrollRegion?.(label) ?? `${label} 스크롤 영역`"
      tabindex="0"
      :style="{ height: height + 'px', '--sc-virtual-row-height': minHeight + 'px' }"
      @focusin="focusIn"
      @focusout="focusOut"
    >
      <ul class="sc-virtual-list__items" role="list" :aria-label="label">
        <template v-for="segment in segments" :key="segment.key">
          <li
            v-if="segment.spacer !== undefined"
            role="presentation"
            aria-hidden="true"
            :style="{ height: segment.spacer + 'px' }"
          />
          <li
            v-else-if="segment.item"
            :ref="measure"
            :data-index="segment.item.index"
            :data-row-key="entries[segment.item.index].key"
            :aria-posinset="segment.item.index + 1"
            :aria-setsize="items.length"
            class="sc-virtual-list__row"
          >
            <button
              type="button"
              class="sc-table-button"
              data-sc-focus="row"
              @keydown="navigateRow($event)"
            >
              {{ itemLabel(items[segment.item.index]) }}
            </button>
            <slot
              name="item"
              :item="items[segment.item.index]"
              :item-key="entries[segment.item.index].key"
              :index="segment.item.index"
            />
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, ref, useAttrs } from "vue";
import { pickScHtmlAttrs } from "../contracts";
import type {
  ScVirtualHandle,
  ScVirtualListEmits,
  ScVirtualListProps,
  ScVirtualListSlots,
} from "./contracts";
import { resolveTableLabels } from "./labels";
import { validateRowKeys } from "./model";
import { useVirtualRows } from "./useVirtualRows";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScVirtualListProps<T>>(), {
  height: 480,
  estimateRowHeight: 48,
  overscan: 8,
  loading: false,
});
const emit = defineEmits<ScVirtualListEmits>();
defineSlots<ScVirtualListSlots<T>>();
const attrs = useAttrs();
const text = computed(() => resolveTableLabels(props.labels));
const viewport = ref<HTMLElement | null>(null);
const entries = computed(() =>
  validateRowKeys(props.items, props.getItemKey).map((key) => ({ key })),
);
const {
  segments,
  height,
  minHeight,
  currentIndex,
  measure,
  scrollToKey,
  focusRow,
  focusIn,
  focusOut,
  moveRow,
} = useVirtualRows(entries, viewport, props);
defineExpose<ScVirtualHandle>({ scrollToKey, focusRow });
const itemLabel = (item: T) => props.getItemLabel?.(item) ?? props.getItemKey(item);
function listAttrs() {
  return pickScHtmlAttrs(attrs, { attributes: ["id"], omit: ["role", "aria-busy"] });
}
function retry() {
  if (!props.loading) emit("retry");
}
function navigateRow(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const direction = (
    { ArrowUp: "previous", ArrowDown: "next", Home: "first", End: "last" } as const
  )[event.key as "ArrowUp" | "ArrowDown" | "Home" | "End"];
  if (direction) {
    event.preventDefault();
    void moveRow(direction);
  }
}
</script>

<style scoped lang="scss">
@use "./table";
.sc-virtual-list__items {
  margin: 0;
  padding: 0;
  list-style: none;
}
.sc-virtual-list__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sc-space-3);
  min-height: var(--sc-virtual-row-height);
  padding: var(--sc-space-2) var(--sc-space-3);
  box-sizing: border-box;
  border-bottom: 1px solid var(--sc-color-border);
  overflow-wrap: anywhere;
}
</style>
