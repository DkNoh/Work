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
