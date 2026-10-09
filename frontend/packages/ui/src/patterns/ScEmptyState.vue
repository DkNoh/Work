<template>
  <div v-bind="pickScHtmlAttrs(attrs, { omit: ['role'] })" class="sc-empty-state" role="status">
    <h2>{{ title }}</h2>
    <p v-if="message">{{ message }}</p>
    <div v-if="$slots.actions" class="sc-actions"><slot name="actions" /></div>
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 자료가 없을 때 제목·선택 설명·부모 actions slot을 보여 준다. v-if는 값이나 slot이 없으면 해당 영역을 만들지 않는다.
 */

/*
 * 빈 상태의 이유와 다음 행동은 소비 화면이 결정한다. 이 부품은 props를 표시하는 순수 UI로 조회나 ref 상태가 필요 없다.
 *  role=status는 상태 안내이고 외부 attrs가 역할을 바꾸지 못하게 필터링한다. defineSlots는 actions slot의 타입 계약이다.
 */
import { useAttrs } from "vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScEmptyStateProps, ScEmptyStateSlots } from "./contracts";
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScEmptyStateProps>(), { title: "표시할 자료가 없습니다", message: "" });
defineSlots<ScEmptyStateSlots>();
const attrs = useAttrs();
</script>
<style scoped lang="scss">
.sc-empty-state {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: var(--sc-space-3);
  padding: var(--sc-space-8);
  color: var(--sc-color-text-muted);
}
h2 {
  font-size: var(--sc-font-size-section);
  color: var(--sc-color-text);
}
</style>
