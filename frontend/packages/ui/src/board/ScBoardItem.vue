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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 항목의 drag handle·부모 내용 slot·위/아래 버튼·목적 열 select를 표시한다.
 * 포인터 드래그 외에도 native 버튼/select로 같은 이동을 요청하므로 키보드 사용자가 조작할 수 있다.
 */

/*
 * 보드 내부 항목이다. 실제 item/열 순서는 부모 props이고 destination ref는 사용자가 아직 확정하지 않은 목적 열 입력이다.
 *  relative의 -1|1 union은 위/아래 두 방향만 허용하며 destination emit은 목적 열 ID만 전달한다.
 *  useSortable에는 목록 DOM/handle 참조와 현재 key/열/index를 전달한다. 공통 부품이 서버 승인 전 자료를 재정렬하지 않는다.
 */
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
// computed의 반환값이 함수인 경우다. vendor 옵션 함수 자체를 반응형 값으로 전달하면서 optimistic DOM 재정렬 plugin을 제외한다.
const sortablePlugins = computed<SortableInput<{ itemKey: string; columnId: string }>["plugins"]>(
  () => (defaults) => defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
);
// 서버 결과가 실제 새 열을 반영하면 목적지 입력도 그 열로 맞춘다. 입력 선택 자체로 업무 열을 바꾸지는 않는다.
watch(
  () => props.columnId,
  (value) => {
    destination.value = value;
  },
);
// isDragSource는 vendor composable에서 오는 화면 상태다. :class가 이를 읽어 현재 드래그 중인 항목만 표시한다.
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
