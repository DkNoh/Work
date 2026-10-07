<template>
  <div
    v-bind="tableAttrs()"
    class="sc-data-table"
    :class="{ 'sc-table-presentation--compact': density === 'compact' }"
    :style="tableStyle"
    :aria-busy="loading || undefined"
  >
    <p v-if="loading" class="sc-table-state" role="status">
      <slot name="loading">{{ text.loading }}</slot>
    </p>
    <div v-if="error" class="sc-table-state sc-table-state--error" role="alert">
      <slot name="error" :message="error" :retry="retry">
        <p>{{ error }}</p>
        <sc-action-button
          size="sm"
          intent="neutral"
          variant="text"
          :disabled="loading"
          @click="retry"
        >
          {{ text.retry }}
        </sc-action-button>
      </slot>
    </div>
    <p v-if="!loading && !error && !displayRows.length" class="sc-table-state" role="status">
      <slot name="empty">{{ text.empty }}</slot>
    </p>
    <p v-if="selectionMode !== 'none'" class="sc-table-state" role="status">
      {{ text.selectionCount(selectedKeys.length) }}
    </p>
    <div
      class="sc-table-scroll"
      role="region"
      :aria-label="text.scrollRegion(caption)"
      tabindex="0"
    >
      <table class="sc-table" :aria-rowcount="dataMode === 'server' ? total + 1 : undefined">
        <caption :class="{ 'sc-table__caption--hidden': captionVisibility === 'sr-only' }">
          {{ caption }}
        </caption>
        <thead>
          <tr :aria-rowindex="dataMode === 'server' ? 1 : undefined">
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
              <sc-action-button
                v-if="column.sortable"
                type="button"
                class="sc-table__sort"
                size="sm"
                intent="neutral"
                variant="text"
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
              </sc-action-button>
              <template v-else>{{ column.label }}</template>
            </th>
            <th v-if="slots['row-actions']" scope="col">{{ text.actions }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(entry, index) in displayRows"
            :key="entry.key"
            :data-row-key="entry.key"
            :data-selected="selectedSet.has(entry.key)"
            :aria-rowindex="dataMode === 'server' ? rowOffset + index + 2 : undefined"
          >
            <td v-if="selectionMode !== 'none'" class="sc-table__selection">
              <input
                :type="selectionMode === 'single' ? 'radio' : 'checkbox'"
                :name="selectionName"
                :aria-label="text.selectRow(rowLabel(entry.original))"
                :checked="selectedSet.has(entry.key)"
                :disabled="loading || !canSelect(entry.original)"
                @change="selectRow(entry.key, $event)"
              />
            </td>
            <td v-for="column in columns" :key="column.id">
              <slot
                name="cell"
                :row="entry.original"
                :row-key="entry.key"
                :row-index="rowOffset + index"
                :column-id="column.id"
                :value="column.value(entry.original)"
              >
                {{ column.value(entry.original) ?? "" }}
              </slot>
            </td>
            <td v-if="slots['row-actions']">
              <slot
                name="row-actions"
                :row="entry.original"
                :row-key="entry.key"
                :row-index="rowOffset + index"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <nav
      v-if="pagination"
      class="sc-table-pagination"
      :aria-label="caption + ' ' + text.paginatedView"
    >
      <sc-action-button
        type="button"
        size="sm"
        intent="neutral"
        variant="outlined"
        :disabled="loading || pagination.pageIndex === 0"
        @click="changePage(pagination.pageIndex - 1)"
      >
        {{ text.previousPage }}
      </sc-action-button>
      <span>{{ text.page(pagination.pageIndex + 1, pageCount, total) }}</span>
      <sc-action-button
        type="button"
        size="sm"
        intent="neutral"
        variant="outlined"
        :disabled="loading || pagination.pageIndex + 1 >= pageCount"
        @click="changePage(pagination.pageIndex + 1)"
      >
        {{ text.nextPage }}
      </sc-action-button>
    </nav>
  </div>
</template>

<script setup lang="ts" generic="T extends object">
import { computed, useAttrs, useId } from "vue";
import ScActionButton from "../ScActionButton.vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScDataTableProps, ScDataTableEmits, ScDataTableSlots } from "./contracts";
import { resolveTableLabels } from "./labels";
import { nextSort, selectPageKeys, useTableModel } from "./model";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScDataTableProps<T>>(), {
  dataMode: "client",
  sorting: null,
  selectionMode: "none",
  selectedKeys: () => [],
  loading: false,
  density: "comfortable",
  captionVisibility: "visible",
  minTableWidth: 0,
});
const emit = defineEmits<ScDataTableEmits>();
const slots = defineSlots<ScDataTableSlots<T>>();
const attrs = useAttrs();
const tableStyle = computed(() => ({
  "--sc-table-min-width":
    (Number.isFinite(props.minTableWidth) ? Math.max(0, props.minTableWidth) : 0) + "px",
}));
const selectionName = `sc-table-select-${useId()}`;
const text = computed(() => resolveTableLabels(props.labels));
const { rows: displayRows } = useTableModel(props, true);
const total = computed(() =>
  props.dataMode === "server" ? (props.pagination?.total ?? props.rows.length) : props.rows.length,
);
const pageCount = computed(() =>
  Math.max(1, Math.ceil(total.value / (props.pagination?.pageSize ?? 20))),
);
const rowOffset = computed(() =>
  props.pagination ? props.pagination.pageIndex * props.pagination.pageSize : 0,
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
  return pickScHtmlAttrs(attrs, {
    attributes: ["id"],
    events: ["onFocusin", "onFocusout", "onKeydown", "onKeyup"],
    omit: ["role", "aria-busy"],
  });
}
function ariaSort(id: string, sortable?: boolean) {
  if (!sortable) return undefined;
  return props.sorting?.columnId === id
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
function changePage(pageIndex: number) {
  if (!props.loading && props.pagination && pageIndex >= 0 && pageIndex < pageCount.value)
    emit("change-pagination", { ...props.pagination, pageIndex, total: total.value });
}
function retry() {
  if (!props.loading) emit("retry");
}
</script>

<style scoped lang="scss">
@use "./table";
</style>
