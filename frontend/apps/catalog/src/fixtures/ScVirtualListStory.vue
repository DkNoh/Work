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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 10,000개 합성 목록과 공개 item slot을 보여 주고 버튼으로 목록의 연결/해제를 전환한다.
 */

/*
 * 대량 데이터 전체는 부모 fixture가 가지고 공통 가상 목록은 필요한 DOM만 만든다. 서버 pagination과 다른 기능임을 보여 준다.
 *  mounted ref의 v-if로 라이브러리 스크롤/Observer 수명이 화면 해제 때 정리되는 경로를 반복 확인할 수 있다.
 */
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
