<template>
  <section ref="element" class="sc-board-column" :aria-labelledby="headingId">
    <h2 :id="headingId">
      {{ label }}
      <span>({{ count }})</span>
    </h2>
    <ul class="sc-board-items">
      <slot />
    </ul>
    <p v-if="count === 0">{{ emptyLabel }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { useDroppable } from "@dnd-kit/vue";
const props = defineProps<{
  columnId: string;
  instanceId: string;
  label: string;
  count: number;
  emptyLabel: string;
  disabled: boolean;
}>();
const element = ref<HTMLElement | null>(null);
const headingId = `sc-board-heading-${useId()}`;
useDroppable({
  id: computed(() => `${props.instanceId}:column:${props.columnId}`),
  element,
  disabled: computed(() => props.disabled),
  data: computed(() => ({ columnId: props.columnId })),
});
</script>
<style scoped>
.sc-board-column {
  min-width: 240px;
  background: var(--sc-color-surface-muted);
  padding: var(--sc-space-3);
  border-radius: var(--sc-radius-md);
}
h2 {
  font-size: 16px;
  margin: 0 0 var(--sc-space-3);
}
.sc-board-items {
  display: grid;
  align-content: start;
  gap: var(--sc-space-3);
  padding: 0;
  margin: 0;
  min-height: 48px;
}
</style>
