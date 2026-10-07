<template>
  <section class="sc-stack" aria-label="가상 표 기능 예제" @keydown="changeSourceByKeyboard">
    <p>행에 포커스를 둔 상태에서 F6은 자료 정렬, F7은 같은 ID 자료 교체를 검사합니다.</p>
    <div class="sc-virtual-story-tools">
      <button type="button" @click="restoreSort">금액 내림차순과 선택 행 포커스 복원</button>
      <button type="button" @click="replaceRows">같은 ID 자료 교체와 포커스 복원</button>
      <button type="button" @click="narrow = !narrow">390px 폭 전환</button>
      <button type="button" @click="mounted = !mounted">
        {{ mounted ? "가상 표 해제" : "가상 표 다시 연결" }}
      </button>
    </div>
    <div :style="{ width: narrow ? '390px' : '100%', maxWidth: '100%' }">
      <sc-virtual-table
        v-if="mounted"
        ref="table"
        :rows="rows"
        :columns="tableExampleColumns"
        :get-row-key="tableExampleKey"
        :get-row-label="tableExampleLabel"
        caption="10,000행 자료"
        :sorting="sorting"
        selection-mode="multiple"
        :selected-keys="selectedKeys"
        :height="480"
        :estimate-row-height="48"
        :overscan="8"
        @change-sort="sorting = $event"
        @update:selected-keys="selectedKeys = $event"
      >
        <template #row-actions="{ row }">
          <button
            type="button"
            class="sc-virtual-story-action"
            data-sc-focus="open"
            :aria-label="row.title + ' 열기'"
            @click="opened = row.id"
          >
            열기
          </button>
        </template>
      </sc-virtual-table>
    </div>
    <p role="status" aria-label="선택 ID">{{ selectedKeys.join(", ") || "선택 없음" }}</p>
    <p v-if="opened" role="status">{{ opened }} 열림</p>
    <p v-if="!mounted" role="status">가상 표 연결 해제됨</p>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import { ScVirtualTable, type ScTableSort, type ScVirtualHandle } from "@sc/ui/table";
import {
  createTableExampleRows,
  tableExampleColumns,
  tableExampleKey,
  tableExampleLabel,
} from "./ScTableData";

const props = withDefaults(defineProps<{ longRows?: boolean }>(), { longRows: false });
const rows = ref(createTableExampleRows(10000, props.longRows));
const sorting = ref<ScTableSort | null>(null);
const selectedKeys = ref<string[]>([]);
const table = ref<ScVirtualHandle | null>(null);
const opened = ref("");
const narrow = ref(false);
const mounted = ref(true);
async function restoreSort() {
  sorting.value = { columnId: "amount", direction: "desc" };
  await nextTick();
  if (selectedKeys.value[0]) await table.value?.focusRow(selectedKeys.value[0]);
}
async function replaceRows() {
  rows.value = rows.value.map((row) => ({ ...row, title: row.title + " · 갱신" }));
  await nextTick();
  if (selectedKeys.value[0]) await table.value?.focusRow(selectedKeys.value[0]);
}
function changeSourceByKeyboard(event: KeyboardEvent) {
  if (event.key === "F6") {
    event.preventDefault();
    sorting.value = { columnId: "amount", direction: "desc" };
  }
  if (event.key === "F7") {
    event.preventDefault();
    rows.value = rows.value.map((row) => ({ ...row, title: row.title + " · 갱신" }));
  }
}
</script>

<style scoped lang="scss">
.sc-virtual-story-tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sc-space-2);
}
.sc-virtual-story-tools button,
.sc-virtual-story-action {
  min-height: 44px;
  border: 1px solid var(--sc-color-control-border);
  border-radius: var(--sc-radius-sm);
  background: var(--sc-color-surface);
  color: var(--sc-color-text);
  padding: var(--sc-space-2);
}
button:focus-visible {
  outline: 3px solid var(--sc-color-focus);
  outline-offset: 2px;
}
</style>
