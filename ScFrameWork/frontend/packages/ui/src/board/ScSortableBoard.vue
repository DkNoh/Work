<template>
  <section
    v-bind="boardAttrs()"
    class="sc-sortable-board"
    :aria-label="label"
    :aria-busy="loading || disabled || undefined"
  >
    <p v-if="loading" role="status">{{ text.loading }}</p>
    <div v-if="error" role="alert">
      <p>{{ error }}</p>
      <button type="button" :disabled="disabled" @click="emit('retry')">{{ text.retry }}</button>
    </div>
    <drag-drop-provider :plugins="plugins" @drag-start="startDrag" @drag-end="finishDrag">
      <div
        ref="scrollRegion"
        class="sc-board-scroll"
        tabindex="0"
        role="region"
        :aria-label="`${label}: ${text.scroll}`"
      >
        <div class="sc-board-columns">
          <sc-board-column
            v-for="column in checkedColumns"
            :key="column.id"
            :column-id="column.id"
            :instance-id="instanceId"
            :label="column.label"
            :count="column.items.length"
            :empty-label="text.empty"
            :disabled="!!disabled || !!loading"
          >
            <sc-board-item
              v-for="(item, index) in column.items"
              :key="getItemKey(item)"
              :item-key="getItemKey(item)"
              :column-id="column.id"
              :index="index"
              :count="column.items.length"
              :instance-id="instanceId"
              :label="getItemLabel(item)"
              :labels="text"
              :destinations="destinations"
              :disabled="!movable(item)"
              @relative="moveRelative(column, item, index, $event)"
              @destination="
                requestMove({
                  itemKey: getItemKey(item),
                  fromColumnId: column.id,
                  toColumnId: $event,
                  beforeKey: null,
                })
              "
            >
              <slot name="item" :item="item" :column="column" :index="index">
                <p>{{ getItemLabel(item) }}</p>
              </slot>
            </sc-board-item>
          </sc-board-column>
        </div>
      </div>
    </drag-drop-provider>
    <p class="sc-board-announcement" role="status" aria-live="polite">{{ announcement }}</p>
  </section>
</template>
<script setup lang="ts" generic="T">
import { computed, nextTick, ref, useAttrs, useId, watch } from "vue";
import {
  DragDropProvider,
  type DragStartEvent,
  type DragEndEvent,
  type DragDropProviderProps,
} from "@dnd-kit/vue";
import { Accessibility } from "@dnd-kit/dom";
import { pickScHtmlAttrs } from "../contracts";
import ScBoardItem from "./ScBoardItem.vue";
import ScBoardColumn from "./ScBoardColumn.vue";
import { isBoardMove, validateBoard } from "./helpers";
import type {
  ScSortableBoardProps,
  ScSortableBoardEmits,
  ScSortableBoardSlots,
  ScBoardLabels,
  ScBoardColumn as Column,
  ScBoardMove,
} from "./contracts";
defineOptions({ inheritAttrs: false });
const props = defineProps<ScSortableBoardProps<T>>();
const emit = defineEmits<ScSortableBoardEmits>();
defineSlots<ScSortableBoardSlots<T>>();
const attrs = useAttrs();
function boardAttrs() {
  return pickScHtmlAttrs(attrs, { omit: ["role", "aria-label", "aria-busy"] });
}
const instanceId = `sc-board-${useId()}`;
const defaults: ScBoardLabels = {
  loading: "불러오는 중",
  empty: "항목이 없습니다.",
  retry: "다시 시도",
  move: "이동",
  up: "위로",
  down: "아래로",
  destination: "목적 열",
  scroll: "보드 스크롤 영역",
  instructions:
    "이동 버튼에서 Space 또는 Enter로 시작하고 방향키로 이동합니다. Escape로 취소합니다. 별도 이동 버튼도 사용할 수 있습니다.",
  started: "이동 시작",
  cancelled: "이동 취소",
  requested: "이동 요청",
};
const text = computed(() => ({ ...defaults, ...props.labels }));
const checkedColumns = computed(() => {
  validateBoard(props.columns, props.getItemKey);
  return props.columns;
});
const destinations = computed(() => props.columns.map(({ id, label }) => ({ id, label })));
const announcement = ref("");
const scrollRegion = ref<HTMLElement | null>(null);
let pendingFocus: {
  key: string;
  fromColumnId: string;
  toColumnId: string;
  beforeKey: string | null;
  caller: HTMLElement;
} | null = null;
watch(
  // 부모가 같은 배열을 splice해도 실제 항목 위치가 바뀌면 이동 후 focus를 복구한다.
  () => props.columns.map((column) => [column.id, column.items.map(props.getItemKey)]),
  async () => {
    const pending = pendingFocus;
    if (!pending) return;
    await nextTick();
    if (pendingFocus !== pending) return;
    if (document.activeElement !== document.body && document.activeElement !== pending.caller) {
      pendingFocus = null;
      return;
    }
    const destination = props.columns.find((column) =>
      column.items.some((item) => props.getItemKey(item) === pending.key),
    );
    // 새 Query 자료가 실제 이동을 반영하기 전에는 승인/거절을 추측하지 않는다.
    if (destination?.id !== pending.toColumnId) return;
    const index = destination.items.findIndex((item) => props.getItemKey(item) === pending.key);
    const nextItem = destination.items[index + 1];
    if ((nextItem ? props.getItemKey(nextItem) : null) !== pending.beforeKey) return;
    if (
      pending.fromColumnId === pending.toColumnId &&
      pending.caller.isConnected &&
      !pending.caller.matches(":disabled") &&
      document.activeElement === pending.caller
    ) {
      pendingFocus = null;
      return;
    }
    const row = Array.from(
      scrollRegion.value?.querySelectorAll<HTMLElement>(
        "[data-sc-board-key]:not([aria-hidden='true'])",
      ) ?? [],
    ).find((row) => row.dataset.scBoardKey === pending.key);
    pendingFocus = null;
    const handle = row?.querySelector<HTMLButtonElement>(".sc-board-handle");
    if (handle && !handle.disabled) handle.focus({ preventScroll: true });
  },
);
const plugins = computed<DragDropProviderProps["plugins"]>(
  () => (preset) =>
    preset.map((plugin) =>
      plugin === Accessibility
        ? Accessibility.configure({
            screenReaderInstructions: { draggable: text.value.instructions },
            idPrefix: {
              description: `${instanceId}-instructions`,
              announcement: `${instanceId}-announcement`,
            },
            announcements: {
              dragstart: () => text.value.started,
              dragend: (event: DragEndEvent) =>
                event.canceled ? text.value.cancelled : text.value.requested,
            },
          })
        : plugin,
    ),
);
let dragOrigin: { itemKey: string; columnId: string } | null = null;
function readTarget(data: unknown): { columnId: string; itemKey?: string } | null {
  if (
    !data ||
    typeof data !== "object" ||
    !("columnId" in data) ||
    typeof data.columnId !== "string"
  )
    return null;
  return {
    columnId: data.columnId,
    itemKey: "itemKey" in data && typeof data.itemKey === "string" ? data.itemKey : undefined,
  };
}
function movable(item: T) {
  return !props.disabled && !props.loading && (props.isItemMovable?.(item) ?? true);
}
function startDrag(event: DragStartEvent) {
  const source = readTarget(event.operation.source?.data);
  dragOrigin = source?.itemKey ? { itemKey: source.itemKey, columnId: source.columnId } : null;
  announcement.value = dragOrigin ? `${text.value.started}: ${dragOrigin.itemKey}` : "";
}
function finishDrag(event: DragEndEvent) {
  const source = dragOrigin;
  dragOrigin = null;
  if (event.canceled) {
    announcement.value = text.value.cancelled;
    return;
  }
  const target = readTarget(event.operation.target?.data);
  if (!source || !target) return;
  const destination = props.columns.find((column) => column.id === target.columnId);
  if (!destination) return;
  let beforeKey = target.itemKey ?? null;
  // 같은 열에서 아래쪽 항목에 놓으면 해당 항목 뒤에 삽입한다.
  const sourceIndex = destination.items.findIndex(
    (item) => props.getItemKey(item) === source.itemKey,
  );
  const targetIndex = destination.items.findIndex(
    (item) => props.getItemKey(item) === target.itemKey,
  );
  if (source.columnId === target.columnId && sourceIndex >= 0 && targetIndex > sourceIndex)
    beforeKey = destination.items[targetIndex + 1]
      ? props.getItemKey(destination.items[targetIndex + 1]!)
      : null;
  requestMove({
    itemKey: source.itemKey,
    fromColumnId: source.columnId,
    toColumnId: target.columnId,
    beforeKey,
  });
}
function requestMove(move: ScBoardMove) {
  const item = props.columns
    .find((column) => column.id === move.fromColumnId)
    ?.items.find((item) => props.getItemKey(item) === move.itemKey);
  if (item === undefined || !movable(item) || !isBoardMove(props.columns, props.getItemKey, move))
    return;
  announcement.value = `${text.value.requested}: ${props.getItemLabel(item)} → ${props.columns.find((column) => column.id === move.toColumnId)?.label}`;
  if (
    document.activeElement instanceof HTMLElement &&
    scrollRegion.value?.contains(document.activeElement)
  )
    pendingFocus = {
      key: move.itemKey,
      fromColumnId: move.fromColumnId,
      toColumnId: move.toColumnId,
      beforeKey: move.beforeKey,
      caller: document.activeElement,
    };
  emit("move", move);
}
function moveRelative(column: Column<T>, item: T, index: number, direction: -1 | 1) {
  const before = direction === -1 ? column.items[index - 1] : column.items[index + 2];
  requestMove({
    itemKey: props.getItemKey(item),
    fromColumnId: column.id,
    toColumnId: column.id,
    beforeKey: before === undefined ? null : props.getItemKey(before),
  });
}
</script>
<style scoped>
.sc-sortable-board {
  min-width: 0;
}
.sc-board-scroll {
  overflow: auto;
  padding: var(--sc-space-1);
}
.sc-board-scroll:focus-visible {
  outline: 2px solid var(--sc-color-focus);
  outline-offset: 2px;
}
.sc-board-columns {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(240px, 1fr);
  gap: var(--sc-space-4);
  align-items: start;
}
.sc-board-announcement {
  min-height: 1.5em;
  color: var(--sc-color-text-muted);
  margin-top: var(--sc-space-3);
}
</style>
