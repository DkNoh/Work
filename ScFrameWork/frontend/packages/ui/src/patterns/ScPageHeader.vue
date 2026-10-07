<template>
  <header v-bind="pickScHtmlAttrs(attrs)" class="sc-page-header">
    <div class="sc-page-header__text">
      <p v-if="eyebrow" class="sc-page-header__eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="sc-page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="sc-actions"><slot name="actions" /></div>
  </header>
</template>
<script setup lang="ts">
import { useAttrs } from "vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScPageHeaderProps, ScPageHeaderSlots } from "./contracts";
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScPageHeaderProps>(), { subtitle: "", eyebrow: "" });
defineSlots<ScPageHeaderSlots>();
const attrs = useAttrs();
</script>
<style scoped lang="scss">
.sc-page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sc-space-4);
}
.sc-page-header__text {
  min-width: 0;
}
h1 {
  margin: 0;
  font-size: var(--sc-font-size-title);
  line-height: var(--sc-line-height-title);
  overflow-wrap: anywhere;
}
.sc-page-header__eyebrow {
  color: var(--sc-color-primary);
  font-size: var(--sc-font-size-small);
  font-weight: 700;
  margin-bottom: var(--sc-space-2);
}
.sc-page-header__subtitle {
  margin-top: var(--sc-space-2);
  color: var(--sc-color-text-muted);
  overflow-wrap: anywhere;
}
</style>
