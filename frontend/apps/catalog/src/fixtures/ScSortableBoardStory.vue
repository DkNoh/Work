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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 합성 보드의 item slot에 문구/링크를 넣고 저장 충돌·표시 전환 버튼과 마지막 이동 의도를 보여 준다.
 */

/*
 * 보드는 이동을 직접 저장하지 않으므로 이 fixture가 서버 승인 역할을 모의한다. columns ref는 부모 자료이고 reject면 기존 순서를 유지한다.
 *  Partial<ScSortableBoardProps<BoardStoryItem>>는 Story에서 일부 props만 지정하게 하며 generic item 타입은 key/label 콜백과 slot까지 연결된다.
 */
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
// 공통 move의 beforeKey 계약을 새 열 배열에 적용한다. 이 동기 변환은 합성 성공 응답이며 실제 앱에서는 서버 저장/재조회 뒤 자료를 반영해야 한다.
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
  // 모든 열에서 이동 항목을 제외한 새 배열을 만들고 목적 열에만 삽입한다. 공통 부품에 넘긴 이전 배열은 제자리 수정하지 않는다.
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
