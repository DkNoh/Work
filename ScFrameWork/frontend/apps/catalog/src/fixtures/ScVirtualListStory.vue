<template>
  <section class="sc-stack" aria-label="가상 목록 예제">
    <button type="button" class="sc-virtual-list-story-button" @click="mounted = !mounted">
      {{ mounted ? "가상 목록 해제" : "가상 목록 다시 연결" }}
    </button>
    <sc-virtual-list
      v-if="mounted"
      :items="items"
      label="10,000개 자료 목록"
      :get-item-key="tableExampleKey"
      :get-item-label="tableExampleLabel"
    >
      <template #item="{ item }">
        <span>{{ item.amount }}원</span>
      </template>
    </sc-virtual-list>
    <p v-if="!mounted" role="status">가상 목록 연결 해제됨</p>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ScVirtualList } from "@sc/ui/table";
import { createTableExampleRows, tableExampleKey, tableExampleLabel } from "./ScTableData";
const items = createTableExampleRows(10000);
const mounted = ref(true);
</script>

<style scoped lang="scss">
.sc-virtual-list-story-button {
  min-height: 44px;
  padding: var(--sc-space-2);
  border: 1px solid var(--sc-color-control-border);
  border-radius: var(--sc-radius-sm);
  background: var(--sc-color-surface);
  color: var(--sc-color-text);
}
</style>
