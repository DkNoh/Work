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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 보드의 한 열을 section/h2/ul로 표시한다. 기본 slot에는 ScBoardItem이 만드는 li가 들어가고 빈 열은 emptyLabel로 안내한다.
 */

/*
 * ScSortableBoard 내부의 열 렌더링/드롭 대상 부품이다. columnId는 업무 열 ID, instanceId는 같은 문서의 여러 보드를 구분한다.
 *  ref는 드롭 라이브러리에 전달할 실제 section DOM이다. computed로 props 변화에 맞춰 target ID·비활성 상태·열 정보를 갱신한다.
 *  이 파일은 항목 배열을 옮기지 않는다. 저장 가능한 이동 의도는 상위 보드가 계산해 소비 앱으로 전달한다.
 */
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
