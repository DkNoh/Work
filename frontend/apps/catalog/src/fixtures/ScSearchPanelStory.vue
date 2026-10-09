<template>
  <div class="sc-stack">
    <sc-search-panel v-bind="props" @submit="searchRows" @reset="resetSearch">
      <sc-text-field v-model="draft" label="검색어" />
    </sc-search-panel>
    <p role="status" aria-label="확정 검색어">{{ committed || "전체 조회" }}</p>
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 기본 slot에 검색어 입력을 넣고 검색/초기화 결과를 status에 보여 준다.
 */

/*
 * draft ref는 저장 전 입력, committed ref는 제출해 확정한 조건이다. 매 글자 입력마다 조회 조건을 바꾸지 않는 차이를 설명한다.
 *  ScSearchPanel은 submit/reset 의도만 보내고 이 부모 fixture가 trim·초기화 정책을 결정한다. 실제 API 요청은 없다.
 */
import { ref } from "vue";
import { ScSearchPanel, ScTextField, type ScSearchPanelProps } from "@sc/ui";
const props = defineProps<ScSearchPanelProps>();
const draft = ref("");
const committed = ref("");
function searchRows() {
  committed.value = draft.value.trim();
}
function resetSearch() {
  draft.value = "";
  committed.value = "";
}
</script>
