<template>
  <div
    v-bind="pickScHtmlAttrs(attrs, { omit: ['role', 'aria-busy', 'aria-live'] })"
    class="sc-loading-state"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <v-progress-circular indeterminate size="24" color="primary" aria-hidden="true" />
    <span>{{ label }}</span>
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 자료 조회 중이라는 텍스트와 회전 표시를 함께 배치한다. 회전 아이콘은 장식이어서 aria-hidden으로 중복 읽기를 막는다.
 */

/*
 * 조회 Promise나 타이머를 소유하지 않는 상태 표시 부품이다. 부모가 로딩 여부에 따라 이 컴포넌트를 표시/제거한다.
 *  role=status·aria-live=polite·aria-busy는 고정된 접근성 계약이며 attrs가 덮어쓰지 못하게 제외한다.
 */
import { useAttrs } from "vue";
import { VProgressCircular } from "vuetify/components";
import { pickScHtmlAttrs } from "../contracts";
import type { ScLoadingStateProps } from "./contracts";
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScLoadingStateProps>(), { label: "자료 불러오는 중…" });
const attrs = useAttrs();
</script>
<style scoped lang="scss">
.sc-loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sc-space-3);
  padding: var(--sc-space-8);
  color: var(--sc-color-text-muted);
}
</style>
