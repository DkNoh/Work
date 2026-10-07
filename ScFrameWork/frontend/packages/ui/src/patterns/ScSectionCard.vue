<template>
  <section
    v-bind="pickScHtmlAttrs(attrs, { omit: ['aria-labelledby'] })"
    class="sc-section-card"
    :data-density="density"
    :data-surface="surface"
    :aria-labelledby="headingId"
  >
    <header class="sc-section-card__header">
      <div>
        <h2 :id="headingId">{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="sc-actions"><slot name="actions" /></div>
    </header>
    <div class="sc-section-card__body"><slot /></div>
  </section>
</template>
<script setup lang="ts">
import { useAttrs, useId } from "vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScSectionCardProps, ScSectionCardSlots } from "./contracts";
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScSectionCardProps>(), {
  description: "",
  density: "comfortable",
  surface: "bordered",
});
defineSlots<ScSectionCardSlots>();
const attrs = useAttrs();
const headingId = `sc-section-${useId()}`;
</script>
<style scoped lang="scss">
.sc-section-card {
  min-width: 0;
  background: var(--sc-color-surface);
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
  box-shadow: var(--sc-shadow-card);
}
.sc-section-card__header {
  padding: var(--sc-space-5);
  border-bottom: 1px solid var(--sc-color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sc-space-3);
}
h2 {
  margin: 0;
  font-size: var(--sc-font-size-section);
  line-height: var(--sc-line-height-title);
  overflow-wrap: anywhere;
}
p {
  color: var(--sc-color-text-muted);
  margin-top: var(--sc-space-2);
}
.sc-section-card__body {
  padding: var(--sc-space-5);
}
.sc-section-card__header .sc-actions :deep(a) {
  color: var(--sc-color-text-muted);
  font-size: var(--sc-font-size-small);
  text-decoration: none;
}
.sc-section-card__header .sc-actions :deep(a:hover) {
  color: var(--sc-color-primary);
  text-decoration: underline;
}
.sc-section-card[data-surface="plain"] {
  border: 0;
  overflow: hidden;

  .sc-section-card__header {
    border-bottom: 0;
  }
}
.sc-section-card[data-density="compact"] {
  .sc-section-card__header {
    padding: var(--sc-space-4) var(--sc-space-4) var(--sc-space-3);
    gap: var(--sc-space-2);
  }

  h2 {
    font-size: var(--sc-font-size-body);
    font-weight: var(--sc-font-weight-semibold);
  }

  .sc-section-card__body {
    padding: var(--sc-space-2) var(--sc-space-4) var(--sc-space-4);
  }
}
</style>
