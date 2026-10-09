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
    <!-- 공통 액션 컴포넌트가 submit 버튼을 표시한다. busy/readonly는 조작 표시이고 서버 권한 검사는 별도로 수행된다. -->
    <sc-form-actions
      v-if="!readonly"
      :busy="busy"
      :submit-label="t('kanban.save')"
      :show-cancel="false"
    />
  </form>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 칸반 작업 입력 영역. v-model은 폼 필드와 연결하고 @submit.prevent는 전체 페이지 전송을 막아 saveTask를 실행한다.
 */

// 칸반 작업의 입력/검증을 맡는 자식 컴포넌트다. API 호출과 저장 후 Query 갱신은 부모 화면이 맡는다.
// <script setup>의 최상위 변수/함수는 template에서 사용할 수 있고, TS 타입은 빌드 시 제거된다.
import { computed, watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { ScTextField, ScTextArea, ScSelect, ScFormActions, ScActionButton } from "@sc/ui";
import type { Task, TaskCreateInput, KanbanUser } from "./api";
import { emptyTaskDraft, taskSchema, taskStatuses, taskPriorities, type TaskDraft } from "./schema";
import { kanbanMessages } from "./messages";
// props는 부모가 내려주는 읽기 전용 계약이다. initial을 직접 수정하지 않고 useForm의 별도 입력에 복사한다.
// resetKey는 부모가 선택 변경/저장 성공/명시적 최신 조회를 승인했다는 신호이며 일반 재조회만으로 입력을 덮지 않는다.
const props = defineProps<{
  initial: Task | null;
  resetKey: number;
  users: readonly KanbanUser[];
  busy: boolean;
  readonly: boolean;
  serverErrors: Readonly<Record<string, string>>;
}>();
// defineEmits의 튜플은 이벤트 인수 타입이다. emit("save", 값)이 부모의 @save 핸들러로 전달된다.
const emit = defineEmits<{ save: [input: TaskCreateInput]; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "local", messages: kanbanMessages });
// useForm<T>는 값·오류·dirty 상태를 묶는다. defineField가 돌려준 첫 ref를 v-model에 연결하며 script에서는 .value로 접근한다.
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
// 현재 담당자가 최신 사용자 옵션에 없어도 기존 ID/이름을 남겨 읽기와 저장 기준이 조용히 바뀌지 않게 한다.
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
// watch는 감시 값이 바뀔 때 부수 효과를 실행한다. resetForm은 표시 값뿐 아니라 dirty/검증 기준도 새로 잡는다.
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
// 서버 ApiError.fields는 부모를 통해 전달된다. 필드 오류를 form에 붙이면 template의 error-messages로 표시된다.
watch(
  () => props.serverErrors,
  (errors) => {
    form.setErrors(Object.fromEntries(Object.keys(form.values).map((key) => [key, undefined])));
    form.setErrors(errors);
  },
);
// dirty를 이벤트로 올려 부모의 이동 확인/다른 저장 채널과 연결한다. ref를 서버 세션에 저장하는 동작은 아니다.
watch(
  () => form.meta.value.dirty,
  (dirty) => emit("dirty-change", dirty),
  { immediate: true },
);
// 제출 → 중복/읽기 제한 확인 → safeParse 런타임 검증 → save 이벤트 순서다.
// success=false일 때는 필드 오류만 갱신하고 입력을 유지한다. 검증 성공도 DB 저장 성공을 의미하지 않는다.
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
// 태그는 문자열 분할이 아니라 개별 배열 요소로 보유한다. 새 배열을 대입하며 중복을 막고 최대 개수/길이는 제출 스키마가 검사한다.
function addTag() {
  if (props.busy || props.readonly) return;
  const value = tagInput.value.trim();
  if (!value) return;
  if (!tags.value.includes(value)) tags.value = [...tags.value, value];
  tagInput.value = "";
}
// filter로 새 배열을 만들어 폼 필드에 대입한다. 부모가 준 initial.tags를 직접 변경하지 않는다.
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
