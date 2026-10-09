<template>
  <div
    v-bind="tableAttrs()"
    class="sc-virtual-table"
    :class="{ 'sc-table-presentation--compact': density === 'compact' }"
    :style="{
      '--sc-table-min-width':
        (Number.isFinite(minTableWidth) ? Math.max(0, minTableWidth) : 0) + 'px',
    }"
    :aria-busy="loading || undefined"
  >
    <div class="sc-table-toolbar">
      <button
        ref="viewButton"
        type="button"
        class="sc-table-button"
        :aria-pressed="paginated"
        @click="toggleView"
      >
        {{ paginated ? text.virtualView : text.paginatedView }}
      </button>
      <p :id="hintId">{{ text.virtualHint }}</p>
    </div>
    <sc-data-table
      v-if="paginated"
      ref="fallbackTable"
      v-bind="props"
      :pagination="fallbackPagination"
      @change-sort="emit('change-sort', $event)"
      @change-pagination="changeFallbackPage"
      @update:selected-keys="emit('update:selectedKeys', $event)"
      @retry="retry"
    >
      <template v-if="slots.cell" #cell="cellProps">
        <slot name="cell" v-bind="cellProps" />
      </template>
      <template v-if="slots['row-actions']" #row-actions="rowProps">
        <slot name="row-actions" v-bind="rowProps" />
      </template>
      <template v-if="slots.loading" #loading><slot name="loading" /></template>
      <template v-if="slots.empty" #empty><slot name="empty" /></template>
      <template v-if="slots.error" #error="errorProps">
        <slot name="error" v-bind="errorProps" />
      </template>
    </sc-data-table>
    <template v-else>
      <p v-if="loading" class="sc-table-state" role="status">
        <slot name="loading">{{ text.loading }}</slot>
      </p>
      <div v-if="error" class="sc-table-state sc-table-state--error" role="alert">
        <slot name="error" :message="error" :retry="retry">
          <p>{{ error }}</p>
          <button type="button" class="sc-table-button" :disabled="loading" @click="retry">
            {{ text.retry }}
          </button>
        </slot>
      </div>
      <p v-if="!loading && !error && !displayRows.length" class="sc-table-state" role="status">
        <slot name="empty">{{ text.empty }}</slot>
      </p>
      <p v-if="selectionMode !== 'none'" class="sc-table-state" role="status">
        {{ text.selectionCount(selectedKeys.length) }}
      </p>
      <div class="sc-table-toolbar" role="group" :aria-label="caption">
        <button
          type="button"
          class="sc-table-button"
          :disabled="!displayRows.length"
          @click="moveRow('first')"
        >
          {{ text.firstRow }}
        </button>
        <button
          type="button"
          class="sc-table-button"
          :disabled="!displayRows.length"
          @click="moveRow('previous')"
        >
          {{ text.previousRow }}
        </button>
        <span role="status">
          {{ text.rowPosition(displayRows.length ? currentIndex() + 1 : 0, displayRows.length) }}
        </span>
        <button
          type="button"
          class="sc-table-button"
          :disabled="!displayRows.length"
          @click="moveRow('next')"
        >
          {{ text.nextRow }}
        </button>
        <button
          type="button"
          class="sc-table-button"
          :disabled="!displayRows.length"
          @click="moveRow('last')"
        >
          {{ text.lastRow }}
        </button>
      </div>
      <div
        ref="viewport"
        class="sc-table-scroll"
        role="region"
        :aria-label="text.scrollRegion(caption)"
        :aria-describedby="hintId"
        tabindex="0"
        :style="{ height: height + 'px', '--sc-virtual-row-height': minHeight + 'px' }"
        @focusin="focusIn"
        @focusout="focusOut"
      >
        <table class="sc-table" :aria-rowcount="total + 1">
          <caption
            ref="tableCaption"
            :class="{ 'sc-table__caption--hidden': captionVisibility === 'sr-only' }"
          >
            {{ caption }}
          </caption>
          <thead ref="tableHead">
            <tr aria-rowindex="1">
              <th v-if="selectionMode !== 'none'" scope="col" class="sc-table__selection">
                <input
                  v-if="selectionMode === 'multiple'"
                  type="checkbox"
                  :aria-label="text.selectPage"
                  :checked="allSelected"
                  :indeterminate.prop="someSelected && !allSelected"
                  :disabled="loading || !selectableKeys.length"
                  @change="selectPage"
                />
                <span v-else>{{ text.selection }}</span>
              </th>
              <th
                v-for="column in columns"
                :key="column.id"
                scope="col"
                :aria-sort="ariaSort(column.id, column.sortable)"
              >
                <button
                  v-if="column.sortable"
                  type="button"
                  class="sc-table-button sc-table__sort"
                  :aria-label="sortLabel(column.id, column.label)"
                  :disabled="loading"
                  @click="sortColumn(column.id)"
                >
                  {{ column.label }}
                  <span aria-hidden="true">
                    {{
                      sorting?.columnId === column.id
                        ? sorting.direction === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""
                    }}
                  </span>
                </button>
                <template v-else>{{ column.label }}</template>
              </th>
              <th v-if="slots['row-actions']" scope="col">{{ text.actions }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="segment in segments" :key="segment.key">
              <tr
                v-if="segment.spacer !== undefined"
                aria-hidden="true"
                role="presentation"
                class="sc-table__spacer"
              >
                <td :colspan="columnCount" :style="{ height: segment.spacer + 'px' }" />
              </tr>
              <tr
                v-else-if="segment.item"
                :ref="measure"
                :data-index="segment.item.index"
                :data-row-key="displayRows[segment.item.index].key"
                :data-selected="selectedSet.has(displayRows[segment.item.index].key)"
                :aria-rowindex="rowOffset + segment.item.index + 2"
                class="sc-table__virtual-row"
                :style="{ height: minHeight + 'px' }"
              >
                <td v-if="selectionMode !== 'none'" class="sc-table__selection">
                  <input
                    :type="selectionMode === 'single' ? 'radio' : 'checkbox'"
                    :name="selectionName"
                    data-sc-focus="select"
                    :aria-label="text.selectRow(rowLabel(displayRows[segment.item.index].original))"
                    :checked="selectedSet.has(displayRows[segment.item.index].key)"
                    :disabled="loading || !canSelect(displayRows[segment.item.index].original)"
                    @change="selectRow(displayRows[segment.item.index].key, $event)"
                  />
                </td>
                <td v-for="column in columns" :key="column.id">
                  <slot
                    name="cell"
                    :row="displayRows[segment.item.index].original"
                    :row-key="displayRows[segment.item.index].key"
                    :row-index="rowOffset + segment.item.index"
                    :column-id="column.id"
                    :value="column.value(displayRows[segment.item.index].original)"
                  >
                    {{ column.value(displayRows[segment.item.index].original) ?? "" }}
                  </slot>
                </td>
                <td v-if="slots['row-actions']">
                  <slot
                    name="row-actions"
                    :row="displayRows[segment.item.index].original"
                    :row-key="displayRows[segment.item.index].key"
                    :row-index="rowOffset + segment.item.index"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <nav
        v-if="dataMode === 'server' && pagination"
        class="sc-table-pagination"
        :aria-label="caption + ' ' + text.paginatedView"
      >
        <button
          type="button"
          class="sc-table-button"
          :disabled="loading || pagination.pageIndex === 0"
          @click="requestPage(pagination.pageIndex - 1)"
        >
          {{ text.previousPage }}
        </button>
        <span>{{ text.page(pagination.pageIndex + 1, pageCount, total) }}</span>
        <button
          type="button"
          class="sc-table-button"
          :disabled="loading || pagination.pageIndex + 1 >= pageCount"
          @click="requestPage(pagination.pageIndex + 1)"
        >
          {{ text.nextPage }}
        </button>
      </nav>
    </template>
  </div>
</template>

<script setup lang="ts" generic="T extends object">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 가상 스크롤과 일반 페이지 표를 전환할 수 있다. 일반 표에서는 같은 props/events/slots를 ScDataTable에 이어 준다.
 * 가상 모드는 segments의 빈 높이 spacer와 보이는 행만 렌더하지만 caption·thead·tbody 구조는 실제 table로 유지한다.
 * 키보드용 첫/이전/다음/마지막 행 버튼과 전체 결과 기준의 행 번호를 함께 제공한다.
 */

/*
 * 업무 rows/정렬/선택은 부모 소유이고 paginated/fallbackPageIndex는 사용자가 고른 화면 표현의 로컬 상태다.
 *  generic T는 표 행과 slot 타입을 일치시킨다. ref는 viewport/thead 등의 DOM과 표시 상태, computed는 props에서 계산한 파생값에 쓴다.
 *  가상 행의 높이/포커스 수명은 useVirtualRows에 맡기고 이 SFC는 표의 의미 구조와 일반 표 전환을 담당한다.
 */
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, useId, watch } from "vue";
import { pickScHtmlAttrs } from "../contracts";
import ScDataTable from "./ScDataTable.vue";
import type {
  ScTablePagination,
  ScVirtualHandle,
  ScVirtualTableEmits,
  ScVirtualTableProps,
  ScVirtualTableSlots,
} from "./contracts";
import { resolveTableLabels } from "./labels";
import { nextSort, selectPageKeys, useTableModel } from "./model";
import { useVirtualRows } from "./useVirtualRows";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScVirtualTableProps<T>>(), {
  density: "comfortable",
  captionVisibility: "visible",
  minTableWidth: 0,
  dataMode: "client",
  sorting: null,
  selectionMode: "none",
  selectedKeys: () => [],
  loading: false,
  height: 480,
  estimateRowHeight: 48,
  overscan: 8,
});
const emit = defineEmits<ScVirtualTableEmits>();
const slots = defineSlots<ScVirtualTableSlots<T>>();
const attrs = useAttrs();
const instanceId = useId();
const selectionName = `sc-virtual-select-${instanceId}`;
const hintId = `sc-virtual-hint-${instanceId}`;
const text = computed(() => resolveTableLabels(props.labels));
const { rows: displayRows } = useTableModel(props, false);
const viewport = ref<HTMLElement | null>(null);
const tableCaption = ref<HTMLElement | null>(null);
const tableHead = ref<HTMLElement | null>(null);
const headerHeight = ref(0);
const viewButton = ref<HTMLButtonElement | null>(null);
const fallbackTable = ref<{ $el: HTMLElement } | null>(null);
const {
  segments,
  height,
  minHeight,
  focusedKey,
  currentKey,
  currentIndex,
  measure,
  scrollToKey: scrollVirtualToKey,
  focusRow: focusVirtualRow,
  focusIn,
  focusOut,
  moveRow,
} = useVirtualRows(displayRows, viewport, props, headerHeight);
// 부모가 component ref로 호출할 명령은 key 기반 이동/포커스 두 개만 공개한다. vendor 가상화 인스턴스는 공개하지 않는다.
defineExpose<ScVirtualHandle>({ scrollToKey, focusRow });
const paginated = ref(false);
const fallbackPageIndex = ref(0);
// server 모드는 부모 pagination을 그대로 사용한다. client 일반 보기에서만 로컬 페이지 index를 사용한다.
const fallbackPagination = computed<ScTablePagination>(() =>
  props.dataMode === "server" && props.pagination
    ? props.pagination
    : {
        pageIndex: fallbackPageIndex.value,
        pageSize: props.pagination?.pageSize ?? 20,
        total: props.rows.length,
      },
);
function fallbackRow(key: string) {
  return Array.from(
    fallbackTable.value?.$el.querySelectorAll<HTMLElement>("[data-row-key]") ?? [],
  ).find((row) => row.dataset.rowKey === key);
}
// 어느 보기이든 같은 key로 이동한다. 일반 client 표에서는 그 행이 들어 있는 페이지를 계산한다.
function scrollToKey(key: string): boolean {
  if (!paginated.value) return scrollVirtualToKey(key);
  const index = displayRows.value.findIndex((entry) => entry.key === key);
  if (index < 0) return false;
  currentKey.value = key;
  if (props.dataMode === "client")
    fallbackPageIndex.value = Math.floor(index / fallbackPagination.value.pageSize);
  return true;
}
// 보기 전환/페이지 갱신 뒤 nextTick을 기다려 실제 생성된 입력/버튼에 포커스한다.
async function focusRow(key: string): Promise<boolean> {
  if (!paginated.value) return focusVirtualRow(key);
  if (!scrollToKey(key)) return false;
  await nextTick();
  const control = fallbackRow(key)?.querySelector<HTMLElement>(
    "input:not(:disabled), button:not(:disabled), a[href], [tabindex]",
  );
  control?.focus({ preventScroll: true });
  return Boolean(control && document.activeElement === control);
}
const total = computed(() =>
  props.dataMode === "server" ? (props.pagination?.total ?? props.rows.length) : props.rows.length,
);
const pageCount = computed(() =>
  Math.max(1, Math.ceil(total.value / (props.pagination?.pageSize ?? 20))),
);
// server의 현재 페이지 시작 위치를 더해 화면에 없는 이전 페이지까지 포함한 전체 행 번호를 만든다.
const rowOffset = computed(() =>
  props.dataMode === "server" && props.pagination
    ? props.pagination.pageIndex * props.pagination.pageSize
    : 0,
);
const columnCount = computed(
  () =>
    props.columns.length +
    (props.selectionMode !== "none" ? 1 : 0) +
    (slots["row-actions"] ? 1 : 0),
);
const canSelect = (row: T) => props.isRowSelectable?.(row) ?? true;
const rowLabel = (row: T) => props.getRowLabel?.(row) ?? props.getRowKey(row);
const selectableKeys = computed(() =>
  displayRows.value.filter((entry) => canSelect(entry.original)).map((entry) => entry.key),
);
const selectedSet = computed(() => new Set(props.selectedKeys));
const allSelected = computed(
  () =>
    selectableKeys.value.length > 0 &&
    selectableKeys.value.every((key) => selectedSet.value.has(key)),
);
const someSelected = computed(() => selectableKeys.value.some((key) => selectedSet.value.has(key)));
function tableAttrs() {
  return pickScHtmlAttrs(attrs, { attributes: ["id"], omit: ["role", "aria-busy"] });
}
function ariaSort(id: string, sortable?: boolean) {
  return !sortable
    ? undefined
    : props.sorting?.columnId === id
      ? props.sorting.direction === "asc"
        ? "ascending"
        : "descending"
      : "none";
}
function sortLabel(id: string, label: string) {
  return text.value.sort(label, nextSort(props.sorting, id)?.direction ?? "none");
}
function sortColumn(id: string) {
  if (!props.loading) emit("change-sort", nextSort(props.sorting, id));
}
// 선택 가능 여부는 앱의 isRowSelectable 콜백으로 결정한다. 일반 표와 같은 새 key 배열 이벤트를 사용한다.
function selectRow(key: string, event: Event) {
  const row = displayRows.value.find((entry) => entry.key === key);
  if (props.loading || !row || !canSelect(row.original)) return;
  const checked = (event.target as HTMLInputElement).checked;
  emit(
    "update:selectedKeys",
    props.selectionMode === "single"
      ? checked
        ? [key]
        : []
      : selectPageKeys(props.selectedKeys, [key], checked),
  );
}
function selectPage(event: Event) {
  if (!props.loading)
    emit(
      "update:selectedKeys",
      selectPageKeys(
        props.selectedKeys,
        selectableKeys.value,
        (event.target as HTMLInputElement).checked,
      ),
    );
}
function retry() {
  if (!props.loading) emit("retry");
}
function requestPage(pageIndex: number) {
  if (!props.loading && props.pagination && pageIndex >= 0 && pageIndex < pageCount.value)
    emit("change-pagination", { ...props.pagination, pageIndex });
}
function changeFallbackPage(page: ScTablePagination) {
  if (props.dataMode === "server") emit("change-pagination", page);
  else fallbackPageIndex.value = page.pageIndex;
}
// 선택·포커스 행의 key를 먼저 기억한 뒤 보기만 바꾼다. DOM은 달라져도 가능한 한 같은 업무 행에서 조작을 이어 간다.
async function toggleView() {
  const key = focusedKey.value ?? currentKey.value ?? props.selectedKeys[0];
  paginated.value = !paginated.value;
  if (paginated.value) {
    const index = displayRows.value.findIndex((entry) => entry.key === key);
    if (props.dataMode === "client")
      fallbackPageIndex.value =
        index < 0 ? 0 : Math.floor(index / fallbackPagination.value.pageSize);
    await nextTick();
    const row = Array.from(
      fallbackTable.value?.$el.querySelectorAll<HTMLElement>("[data-row-key]") ?? [],
    ).find((element) => element.dataset.rowKey === key);
    row
      ?.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled), a[href]")
      ?.focus();
  } else {
    await nextTick();
    if (key) await focusRow(key);
  }
}
watch(
  () => [props.sorting, props.rows] as const,
  () => {
    if (paginated.value && props.dataMode === "client")
      fallbackPageIndex.value = Math.min(
        fallbackPageIndex.value,
        Math.max(0, Math.ceil(props.rows.length / fallbackPagination.value.pageSize) - 1),
      );
  },
);
// 줄바꿈/폰트/열 변경으로 caption+thead 높이가 바뀌면 스크롤 시작 여백도 달라진다. 이전 Observer를 해제하고 현재 DOM만 측정한다.
let headerObserver: ResizeObserver | undefined;
watch(
  [tableCaption, tableHead],
  ([caption, head]) => {
    headerObserver?.disconnect();
    const update = () => {
      headerHeight.value =
        (caption?.getBoundingClientRect().height ?? 0) +
        (head?.getBoundingClientRect().height ?? 0);
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      headerObserver = new ResizeObserver(update);
      if (caption) headerObserver.observe(caption);
      if (head) headerObserver.observe(head);
    }
  },
  { flush: "post" },
);
// 브라우저 자원은 컴포넌트 수명에 맞춰 정리한다. 화면을 떠난 뒤 높이 갱신 콜백이 남지 않게 한다.
onBeforeUnmount(() => headerObserver?.disconnect());
</script>

<style scoped lang="scss">
@use "./table";
</style>
