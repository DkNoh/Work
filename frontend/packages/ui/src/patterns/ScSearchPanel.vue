<template>
  <form
    v-bind="pickScHtmlAttrs(attrs, { omit: ['aria-label'] })"
    class="sc-search-panel"
    :aria-label="label"
    @submit.prevent="submitSearch"
    @reset.prevent="resetSearch"
  >
    <fieldset :disabled="disabled">
      <legend class="sc-visually-hidden">{{ label }}</legend>
      <div class="sc-search-panel__fields"><slot /></div>
    </fieldset>
    <div class="sc-actions">
      <slot name="actions">
        <sc-action-button type="submit" :disabled="disabled">{{ submitLabel }}</sc-action-button>
        <sc-action-button type="reset" variant="outlined" :disabled="disabled">
          {{ resetLabel }}
        </sc-action-button>
      </slot>
    </div>
  </form>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 검색 필드는 기본 slot, 버튼은 actions slot에 넣는다. 기본 버튼의 submit/reset은 실제 form 이벤트를 발생시킨다.
 * .prevent는 서버 페이지 이동이나 브라우저의 자동 초기화를 막고 부모의 검색/초기화 처리로 연결한다.
 */

/*
 * 검색어 입력과 URL 조건은 부모가 소유한다. 이 부품은 form·fieldset·버튼의 배치와 이벤트 전달만 담당한다.
 *  disabled는 fieldset의 입력과 기본 버튼을 함께 막는다. actions slot을 교체한 부모는 자신의 버튼 상태도 연결해야 한다.
 */
import { useAttrs } from "vue";
import ScActionButton from "../ScActionButton.vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScSearchPanelProps, ScSearchPanelEmits, ScSearchPanelSlots } from "./contracts";
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScSearchPanelProps>(), {
  label: "검색",
  submitLabel: "검색",
  resetLabel: "초기화",
  disabled: false,
});
const emit = defineEmits<ScSearchPanelEmits>();
defineSlots<ScSearchPanelSlots>();
const attrs = useAttrs();
// submit/reset 이벤트 객체를 그대로 부모에 전달한다. 검색 실행 시점과 Query key 변경은 여기서 결정하지 않는다.
function submitSearch(event: SubmitEvent) {
  if (!props.disabled) emit("submit", event);
}
function resetSearch(event: Event) {
  if (!props.disabled) emit("reset", event);
}
</script>
<style scoped lang="scss">
.sc-search-panel {
  display: flex;
  align-items: start;
  flex-wrap: wrap;
  gap: var(--sc-space-4);
  padding: var(--sc-space-5);
  background: var(--sc-color-surface-muted);
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
}
fieldset {
  flex: 1;
  min-width: min(100%, 16rem);
  padding: 0;
  margin: 0;
  border: 0;
}
.sc-search-panel__fields {
  display: flex;
  align-items: start;
  flex-wrap: wrap;
  gap: var(--sc-space-4);
}
.sc-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
