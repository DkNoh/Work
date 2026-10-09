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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * ScSortableBoard의 move 이벤트를 moveItem에 연결한다. 키보드와 포인터 이동이 같은 부모 갱신 함수로 모인다.
 */

/**
 * 공통 보드가 이동 의도를 emit하면 부모가 실제 배열을 갱신하는 최소 예제다. props 내부 배열을 공통 UI가 직접 변경하지 않는다.
 * Item은 행의 TypeScript 구조 타입이다. 열 ID/항목 ID/beforeKey로 이동 위치를 표현하여 DOM 인덱스에 업무 규칙을 결합하지 않는다.
 * values는 로컬 예제 자료이며 columns는 번역 label을 더한 computed다. 실제 업무 보드는 Service 권한/revision 검사 후 결과를 반영해야 한다.
 */

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
/**
 * 원본 열에서 항목을 꺼내 목적 열의 beforeKey 앞에 넣는다. beforeKey가 없으면 끝에 추가하며 이 예제는 서버 저장을 수행하지 않는다.
 */
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
