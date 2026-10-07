<template>
  <div class="sc-stack">
    <sc-search-panel v-bind="props" @submit="searchRows" @reset="resetSearch">
      <sc-text-field v-model="draft" label="검색어" />
    </sc-search-panel>
    <p role="status" aria-label="확정 검색어">{{ committed || "전체 조회" }}</p>
  </div>
</template>
<script setup lang="ts">
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
