<template>
  <div class="sc-stack">
    <sc-select
      :model-value="String(boardId)"
      :label="t('kanban.board')"
      :options="boards.map((board) => ({ value: String(board.id), label: board.title }))"
      :disabled="busy"
      @update:model-value="selectBoard"
    />
    <form class="board-editor" @submit.prevent="createBoard">
      <sc-text-field
        v-model="newTitle"
        :label="t('kanban.boardTitle')"
        :disabled="busy"
        :max-length="100"
        required
      />
      <sc-action-button type="submit" :busy="busy">{{ t("kanban.createBoard") }}</sc-action-button>
    </form>
    <form v-if="selected?.canRename" class="board-editor" @submit.prevent="renameBoard">
      <sc-text-field
        v-model="renameTitle"
        :label="t('kanban.boardTitle')"
        :disabled="busy"
        :max-length="100"
        required
      />
      <sc-action-button type="submit" :busy="busy">{{ t("kanban.renameBoard") }}</sc-action-button>
    </form>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ScTextField, ScSelect, ScActionButton } from "@sc/ui";
import type { Board } from "./api";
import { kanbanMessages } from "./messages";
const props = defineProps<{ boards: readonly Board[]; boardId: number; busy: boolean }>();
const emit = defineEmits<{
  select: [id: number];
  create: [title: string];
  rename: [board: Board, title: string];
}>();
const { t } = useI18n({ useScope: "local", messages: kanbanMessages });
const newTitle = ref("");
const renameTitle = ref("");
const selected = computed(() => props.boards.find((board) => board.id === props.boardId));
watch(
  () => [selected.value?.id, selected.value?.revision],
  () => {
    renameTitle.value = selected.value?.title ?? "";
  },
  { immediate: true },
);
function selectBoard(value: string | null) {
  const id = Number(value);
  if (Number.isSafeInteger(id) && id > 0 && !props.busy) emit("select", id);
}
function createBoard() {
  if (!props.busy && newTitle.value.trim()) emit("create", newTitle.value);
}
function renameBoard() {
  if (!props.busy && selected.value?.canRename && renameTitle.value.trim())
    emit("rename", selected.value, renameTitle.value);
}
</script>
<style scoped lang="scss">
@use "@sc/ui/tokens" with (
  $sc-emit-css: false
);

.board-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--sc-space-4);
}
.board-editor > * {
  min-width: 0;
}
@media (max-width: tokens.$sc-breakpoint-sm - 1px) {
  .board-editor {
    grid-template-columns: minmax(0, 1fr);
  }
  .board-editor > :last-child {
    justify-self: start;
  }
}
</style>
