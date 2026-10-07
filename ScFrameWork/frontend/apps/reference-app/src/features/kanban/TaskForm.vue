<template>
  <form class="sc-stack" novalidate :aria-label="t('kanban.form')" @submit.prevent="saveTask">
    <sc-text-field
      v-model="title"
      :label="t('kanban.titleField')"
      required
      :max-length="200"
      :readonly="readonly"
      :disabled="busy"
      :error-messages="form.errors.value.title"
    />
    <sc-text-area
      v-model="description"
      :label="t('kanban.description')"
      :max-length="10000"
      :readonly="readonly"
      :disabled="busy"
      :error-messages="form.errors.value.description"
    />
    <div class="task-fields">
      <sc-select
        v-model="status"
        :label="t('kanban.status')"
        :options="statusOptions"
        :readonly="readonly"
        :disabled="busy"
        :error-messages="form.errors.value.status"
      />
      <sc-select
        v-model="priority"
        :label="t('kanban.priority')"
        :options="priorityOptions"
        :readonly="readonly"
        :disabled="busy"
        :error-messages="form.errors.value.priority"
      />
      <sc-select
        v-model="assigneeId"
        :label="t('kanban.assignee')"
        :options="userOptions"
        :readonly="readonly"
        :disabled="busy"
        :error-messages="form.errors.value.assigneeId"
      />
      <sc-text-field
        v-model="dueDate"
        :label="t('kanban.date')"
        placeholder="YYYY-MM-DD"
        :readonly="readonly"
        :disabled="busy"
        :error-messages="form.errors.value.dueDate"
      />
    </div>
    <ul v-if="tags.length" class="task-tag-list">
      <li v-for="tag in tags" :key="tag">
        <span class="task-tag-label">{{ tag }}</span>
        <sc-action-button
          v-if="!readonly"
          variant="text"
          :disabled="busy"
          :aria-label="`${tag}: ${t('kanban.removeTag')}`"
          @click="removeTag(tag)"
        >
          {{ t("kanban.removeTag") }}
        </sc-action-button>
      </li>
    </ul>
    <div v-if="!readonly" class="task-tag-entry">
      <sc-text-field
        v-model="tagInput"
        :label="t('kanban.tags')"
        :disabled="busy"
        :max-length="30"
        :error-messages="form.errors.value.tags"
      />
      <sc-action-button
        :disabled="busy || !tagInput.trim()"
        :aria-label="t('kanban.addTag')"
        @click="addTag"
      >
        +
      </sc-action-button>
    </div>
    <sc-form-actions
      v-if="!readonly"
      :busy="busy"
      :submit-label="t('kanban.save')"
      :show-cancel="false"
    />
  </form>
</template>
<script setup lang="ts">
import { computed, watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { ScTextField, ScTextArea, ScSelect, ScFormActions, ScActionButton } from "@sc/ui";
import type { Task, TaskCreateInput, KanbanUser } from "./api";
import { emptyTaskDraft, taskSchema, taskStatuses, taskPriorities, type TaskDraft } from "./schema";
import { kanbanMessages } from "./messages";
const props = defineProps<{
  initial: Task | null;
  resetKey: number;
  users: readonly KanbanUser[];
  busy: boolean;
  readonly: boolean;
  serverErrors: Readonly<Record<string, string>>;
}>();
const emit = defineEmits<{ save: [input: TaskCreateInput]; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "local", messages: kanbanMessages });
const form = useForm<TaskDraft>({ initialValues: emptyTaskDraft() });
const [title] = form.defineField("title");
const [description] = form.defineField("description");
const [status] = form.defineField("status");
const [priority] = form.defineField("priority");
const [assigneeId] = form.defineField("assigneeId");
const [dueDate] = form.defineField("dueDate");
const [tags] = form.defineField("tags");
const [tagInput] = form.defineField("tagInput");
const statusOptions = computed(() =>
  taskStatuses.map((value) => ({ value, label: t(`kanban.${value}`) })),
);
const priorityOptions = computed(() =>
  taskPriorities.map((value) => ({ value, label: t(`kanban.${value}`) })),
);
const userOptions = computed(() => {
  const choices = [
    { value: "", label: "—" },
    ...props.users.map((user) => ({ value: String(user.id), label: user.displayName })),
  ];
  const initial = props.initial;
  if (initial?.assigneeId && !props.users.some((user) => user.id === initial.assigneeId))
    choices.push({
      value: String(initial.assigneeId),
      label: initial.assigneeName ?? String(initial.assigneeId),
    });
  return choices;
});
watch(
  () => props.resetKey,
  () => {
    const item = props.initial;
    form.resetForm({
      values: item
        ? {
            title: item.title,
            description: item.description,
            status: item.status,
            priority: item.priority,
            assigneeId: item.assigneeId === null ? "" : String(item.assigneeId),
            dueDate: item.dueDate ?? "",
            tags: [...item.tags],
            tagInput: "",
          }
        : emptyTaskDraft(),
    });
  },
  { immediate: true },
);
watch(
  () => props.serverErrors,
  (errors) => {
    form.setErrors(Object.fromEntries(Object.keys(form.values).map((key) => [key, undefined])));
    form.setErrors(errors);
  },
);
watch(
  () => form.meta.value.dirty,
  (dirty) => emit("dirty-change", dirty),
  { immediate: true },
);
function saveTask() {
  if (props.busy || props.readonly) return;
  if (tagInput.value.trim()) addTag();
  const parsed = taskSchema.safeParse(form.values);
  if (!parsed.success) {
    form.setErrors(
      Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    );
    return;
  }
  emit("save", parsed.data);
}
function addTag() {
  if (props.busy || props.readonly) return;
  const value = tagInput.value.trim();
  if (!value) return;
  if (!tags.value.includes(value)) tags.value = [...tags.value, value];
  tagInput.value = "";
}
function removeTag(tag: string) {
  if (!props.busy && !props.readonly) tags.value = tags.value.filter((value) => value !== tag);
}
</script>
<style scoped>
.task-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--sc-space-4);
}
.task-tag-entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--sc-space-3);
}
.task-tag-entry > * {
  min-width: 0;
}
.task-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sc-space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.task-tag-list li {
  display: flex;
  align-items: center;
  gap: var(--sc-space-1);
  min-width: 0;
  max-width: 100%;
  padding: var(--sc-space-1) var(--sc-space-2);
  border-radius: var(--sc-radius-sm);
  background: var(--sc-color-surface-muted);
}
.task-tag-label {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
