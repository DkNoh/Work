<template>
  <div v-bind="pickScHtmlAttrs(attrs, { omit: ['role'] })" class="sc-empty-state" role="status">
    <h2>{{ title }}</h2>
    <p v-if="message">{{ message }}</p>
    <div v-if="$slots.actions" class="sc-actions"><slot name="actions" /></div>
  </div>
</template>
<script setup lang="ts">
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
