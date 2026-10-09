<template>
  <div v-bind="pickScHtmlAttrs(attrs, { omit: ['role'] })" class="sc-error-panel" role="alert">
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <sc-action-button v-if="showRetry" variant="outlined" @click="emit('retry')">
      {{ retryLabel }}
    </sc-action-button>
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 실패 제목과 message를 alert 영역에 표시한다. showRetry일 때만 다시 조회 버튼이 나타나고 클릭은 retry 이벤트가 된다.
 */

/*
 * 실제 HTTP 오류를 사용자 문구로 바꾸고 재조회하는 책임은 부모에 있다. 이 컴포넌트는 전달된 안전한 message만 표시한다.
 *  withDefaults는 생략 가능한 표시 props의 기본값을 지정한다. emit retry에는 인자가 없으며 원래 요청을 자동 재실행하지 않는다.
 */
import { useAttrs } from "vue";
import ScActionButton from "../ScActionButton.vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScErrorPanelProps, ScErrorPanelEmits } from "./contracts";
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScErrorPanelProps>(), {
  title: "조회하지 못했습니다",
  retryLabel: "다시 조회",
  showRetry: true,
});
const emit = defineEmits<ScErrorPanelEmits>();
const attrs = useAttrs();
</script>
<style scoped lang="scss">
.sc-error-panel {
  display: grid;
  justify-items: start;
  gap: var(--sc-space-3);
  padding: var(--sc-space-5);
  border: 1px solid var(--sc-color-error);
  border-radius: var(--sc-radius-md);
}
h2 {
  font-size: var(--sc-font-size-section);
}
p {
  overflow-wrap: anywhere;
}
</style>
