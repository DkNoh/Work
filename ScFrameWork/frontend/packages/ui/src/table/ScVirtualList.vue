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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 상태 안내·행 탐색 버튼·스크롤 영역·ul 목록을 표시한다. 보이지 않는 구간은 장식용 spacer li로 높이만 유지한다.
 * aria-posinset/setsize는 렌더된 일부 DOM이 아니라 전체 items에서의 위치를 설명한다. item slot은 부모의 추가 콘텐츠다.
 */

/*
 * generic T로 어떤 업무 item도 받을 수 있으나 key/이름은 앱 콜백으로 얻는다. items 배열은 읽기 전용 입력이다.
 *  useVirtualRows가 가상 범위와 포커스를 관리하며 이 파일은 목록 구조와 방향키 탐색을 연결한다.
 */
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
// 항목 키가 바뀌면 검증 후 표시용 key 목록을 다시 만든다. 선택/포커스의 기준이므로 빈 키나 중복 키를 허용하지 않는다.
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
// 부모는 공개 handle로 특정 업무 key를 스크롤/포커스할 수 있다. DOM index는 재정렬에 불안정해 외부 API로 노출하지 않는다.
defineExpose<ScVirtualHandle>({ scrollToKey, focusRow });
const itemLabel = (item: T) => props.getItemLabel?.(item) ?? props.getItemKey(item);
function listAttrs() {
  return pickScHtmlAttrs(attrs, { attributes: ["id"], omit: ["role", "aria-busy"] });
}
function retry() {
  if (!props.loading) emit("retry");
}
// 조합키는 브라우저/보조기술에 남겨 두고 기본 방향키/Home/End만 목록 탐색으로 처리한다. as const는 목적지 문자열을 union 타입으로 유지한다.
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
