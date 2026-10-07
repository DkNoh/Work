<template>
  <section class="sc-stack">
    <div class="sc-inline">
      <sc-action-button @click="reject = !reject">저장 충돌 모의</sc-action-button>
      <sc-action-button @click="visible = !visible">보드 표시 전환</sc-action-button>
    </div>
    <sc-sortable-board
      v-if="visible"
      v-bind="props"
      :columns="columns"
      :get-item-key="getKey"
      :get-item-label="getLabel"
      label="중립 이동 보드"
      :error="failure || props.error"
      @move="acceptMove"
      @retry="failure = ''"
    >
      <template #item="{ item }">
        <p>{{ item.title }}</p>
        <a :href="`#item-${item.id}`">{{ item.title }} 상세</a>
      </template>
    </sc-sortable-board>
    <output role="status" aria-label="이동 의도">{{ lastMove }}</output>
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from "vue";
import { ScActionButton } from "@sc/ui";
import {
  ScSortableBoard,
  type ScSortableBoardProps,
  type ScBoardColumn,
  type ScBoardMove,
} from "@sc/ui/board";
export interface BoardStoryItem {
  id: string;
  title: string;
}
const props = defineProps<Partial<ScSortableBoardProps<BoardStoryItem>>>();
const initial: readonly ScBoardColumn<BoardStoryItem>[] = [
  {
    id: "first",
    label: "첫 열",
    items: [
      { id: "alpha", title: "Alpha" },
      { id: "beta", title: "Beta" },
    ],
  },
  { id: "second", label: "둘째 열", items: [] },
];
const columns = ref(props.columns ?? initial);
const reject = ref(false);
const visible = ref(true);
const failure = ref("");
const lastMove = ref("");
const getKey = (item: BoardStoryItem) => item.id;
const getLabel = (item: BoardStoryItem) => item.title;
watch(
  () => props.columns,
  (value) => {
    columns.value = value ?? initial;
  },
);
function acceptMove(move: ScBoardMove) {
  lastMove.value = JSON.stringify(move);
  if (reject.value) {
    failure.value = "409 이동 충돌";
    return;
  }
  const item = columns.value
    .flatMap((column) => column.items)
    .find((item) => item.id === move.itemKey);
  if (!item) return;
  columns.value = columns.value.map((column) => {
    const items = column.items.filter((row) => row.id !== move.itemKey);
    if (column.id === move.toColumnId) {
      const at =
        move.beforeKey === null
          ? items.length
          : items.findIndex((row) => row.id === move.beforeKey);
      items.splice(at < 0 ? items.length : at, 0, item);
    }
    return { ...column, items };
  });
}
</script>
