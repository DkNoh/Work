<template>
  <li
    ref="element"
    class="sc-board-item"
    :data-sc-board-key="itemKey"
    :class="{ 'sc-board-item--dragging': isDragSource }"
  >
    <button
      ref="handle"
      type="button"
      class="sc-board-handle"
      :disabled="disabled"
      :aria-label="`${labels.move}: ${label}`"
    >
      {{ labels.move }}: {{ label }}
    </button>
    <slot />
    <div v-if="!disabled" class="sc-board-controls">
      <button
        type="button"
        :aria-label="`${label}: ${labels.up}`"
        :disabled="index === 0"
        @click="emit('relative', -1)"
      >
        {{ labels.up }}
      </button>
      <button
        type="button"
        :aria-label="`${label}: ${labels.down}`"
        :disabled="index === count - 1"
        @click="emit('relative', 1)"
      >
        {{ labels.down }}
      </button>
      <label :for="destinationId">{{ labels.destination }}</label>
      <select :id="destinationId" v-model="destination">
        <option v-for="column in destinations" :key="column.id" :value="column.id">
          {{ column.label }}
        </option>
      </select>
      <button
        type="button"
        :disabled="destination === columnId"
        :aria-label="`${label}: ${labels.move}`"
        @click="emit('destination', destination)"
      >
        {{ labels.move }}
      </button>
    </div>
  </li>
</template>
<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { useSortable } from "@dnd-kit/vue/sortable";
import { OptimisticSortingPlugin, type SortableInput } from "@dnd-kit/dom/sortable";
import type { ScBoardLabels } from "./contracts";
const props = defineProps<{
  itemKey: string;
  columnId: string;
  index: number;
  count: number;
  label: string;
  disabled: boolean;
  instanceId: string;
  labels: ScBoardLabels;
  destinations: readonly { id: string; label: string }[];
}>();
const emit = defineEmits<{ relative: [direction: -1 | 1]; destination: [columnId: string] }>();
const element = ref<HTMLElement | null>(null);
const handle = ref<HTMLElement | null>(null);
const destinationId = `sc-board-destination-${useId()}`;
const destination = ref(props.columnId);
// composable의 toValue가 옵션 함수를 getter로 호출하지 않도록 함수값을 ref로 전달한다.
const sortablePlugins = computed<SortableInput<{ itemKey: string; columnId: string }>["plugins"]>(
  () => (defaults) => defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
);
watch(
  () => props.columnId,
  (value) => {
    destination.value = value;
  },
);
const { isDragSource } = useSortable({
  id: computed(() => `${props.instanceId}:item:${props.itemKey}`),
  group: computed(() => `${props.instanceId}:column:${props.columnId}`),
  index: computed(() => props.index),
  element,
  handle,
  disabled: computed(() => ({ draggable: props.disabled })),
  data: computed(() => ({ itemKey: props.itemKey, columnId: props.columnId })),
  // 서버가 저장을 승인하기 전에 DOM 순서를 변경하지 않는다.
  plugins: sortablePlugins,
});
</script>
<style scoped>
.sc-board-item {
  list-style: none;
  padding: var(--sc-space-3);
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
  background: var(--sc-color-surface);
  min-width: 0;
  overflow-wrap: anywhere;
}
.sc-board-item--dragging {
  outline: 2px solid var(--sc-color-focus);
}
.sc-board-handle {
  touch-action: none;
  width: 100%;
  text-align: start;
  font-weight: 700;
}
.sc-board-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sc-space-2);
  margin-top: var(--sc-space-3);
}
button,
select {
  color: var(--sc-color-text);
  background: var(--sc-color-surface);
  border: 1px solid var(--sc-color-control-border);
  border-radius: var(--sc-radius-sm);
  min-height: 32px;
  padding: var(--sc-space-1) var(--sc-space-2);
}
button:disabled {
  cursor: default;
}
button:focus-visible,
select:focus-visible {
  outline: 2px solid var(--sc-color-focus);
  outline-offset: 2px;
}
</style>
