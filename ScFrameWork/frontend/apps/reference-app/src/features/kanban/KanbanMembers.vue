<template>
  <sc-section-card :title="t('kanban.members')">
    <ul class="kanban-members">
      <li v-for="member in members" :key="member.id">
        <sc-checkbox
          :model-value="member.kanbanAccess"
          :label="`${member.displayName}: ${t('kanban.access')}`"
          :disabled="busy || member.role === 'ADMIN'"
          @update:model-value="emit('change', member.id, $event)"
        />
      </li>
    </ul>
  </sc-section-card>
</template>
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ScCheckbox, ScSectionCard } from "@sc/ui";
import type { KanbanMember } from "./api";
import { kanbanMessages } from "./messages";
defineProps<{ members: readonly KanbanMember[]; busy: boolean }>();
const emit = defineEmits<{ change: [id: number, allowed: boolean] }>();
const { t } = useI18n({ useScope: "local", messages: kanbanMessages });
</script>
<style scoped>
.kanban-members {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--sc-space-3);
}
</style>
