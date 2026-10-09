<template>
  <sc-section-card :title="english ? 'Sortable board' : '항목 이동 보드'">
    <sc-sortable-board
      :label="english ? 'Sample work items' : '중립 작업 항목'"
      :columns="columns"
      :get-item-key="getKey"
      :get-item-label="getLabel"
      :labels="english ? englishBoardLabels : undefined"
      @move="moveItem"
    >
      <template #item="{ item }">
        <p>{{ item.title }}</p>
      </template>
    </sc-sortable-board>
    <p>
      {{ english ? "Changes stay in this example." : "변경 사항은 이 예제 안에서 유지됩니다." }}
    </p>
  </sc-section-card>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ScSectionCard } from "@sc/ui";
import { ScSortableBoard, type ScBoardColumn, type ScBoardMove } from "@sc/ui/board";
import { englishBoardLabels } from "./board-image-labels";
interface Item {
  id: string;
  title: string;
}
const { locale } = useI18n({ useScope: "global" });
const english = computed(() => locale.value === "en");
const values = ref([
  {
    id: "ready",
    items: [
      { id: "a", title: "Alpha" },
      { id: "b", title: "Beta" },
    ],
  },
  { id: "finished", items: [] },
]);
const columns = computed<readonly ScBoardColumn<Item>[]>(() =>
  values.value.map((column) => ({
    ...column,
    label:
      column.id === "ready"
        ? english.value
          ? "Ready"
          : "준비"
        : english.value
          ? "Finished"
          : "완료",
  })),
);
const getKey = (item: Item) => item.id;
const getLabel = (item: Item) => item.title;
function moveItem(move: ScBoardMove) {
  const source = values.value.find((column) => column.id === move.fromColumnId);
  const target = values.value.find((column) => column.id === move.toColumnId);
  if (!source || !target) return;
  const index = source.items.findIndex((item) => item.id === move.itemKey);
  const [item] = source.items.splice(index, 1);
  if (!item) return;
  const before =
    move.beforeKey === null
      ? target.items.length
      : target.items.findIndex((row) => row.id === move.beforeKey);
  target.items.splice(before < 0 ? target.items.length : before, 0, item);
}
</script>
