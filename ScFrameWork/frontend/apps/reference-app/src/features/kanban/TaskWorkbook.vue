<template>
  <sc-section-card :title="t('kanban.importTitle')">
    <div class="sc-actions">
      <sc-action-button :disabled="busy" @click="download(false)">
        {{ t("kanban.export") }}
      </sc-action-button>
      <sc-action-button :disabled="busy" @click="download(true)">
        {{ t("kanban.template") }}
      </sc-action-button>
    </div>
    <label :for="fileId">{{ t("kanban.file") }}</label>
    <input
      :id="fileId"
      type="file"
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      :disabled="busy"
      @change="readFile"
    />
    <p v-if="error" role="alert">{{ error }}</p>
    <ul v-if="errors.length" aria-label="Excel 오류">
      <li v-for="(message, index) in errors" :key="index">{{ message }}</li>
    </ul>
    <div v-if="stage.length" class="sc-stack">
      <sc-data-table
        :caption="t('kanban.preview')"
        :rows="stage"
        :columns="columns"
        :get-row-key="rowKey"
        :pagination="{ pageIndex: 0, pageSize: 200, total: stage.length }"
      />
      <p>{{ t("kanban.count") }}: {{ stage.length }}</p>
      <div class="sc-actions">
        <sc-action-button :disabled="busy || errors.length > 0" @click="confirmOpen = true">
          {{ t("kanban.approve") }}
        </sc-action-button>
        <sc-action-button :disabled="busy" @click="discard">
          {{ t("kanban.discard") }}
        </sc-action-button>
      </div>
    </div>
    <p role="status">{{ success }}</p>
    <sc-confirm-dialog
      v-model="confirmOpen"
      :title="t('kanban.approve')"
      :message="t('kanban.importConfirm')"
      :busy="busy"
      :confirm-label="t('kanban.approve')"
      :cancel-label="t('kanban.cancel')"
      @confirm="persist"
    />
  </sc-section-card>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError } from "@sc/runtime";
import { readWorkbook, writeWorkbook, type ScWorkbookColumn } from "@sc/excel";
import { ScActionButton, ScSectionCard, ScConfirmDialog } from "@sc/ui";
import { ScDataTable, type ScTableColumn } from "@sc/ui/table";
import { useReferenceRuntime } from "../../auth/identity";
import { createKanbanApi, type Task, type TaskImportInput } from "./api";
import { taskSchema } from "./schema";
import { kanbanMessages } from "./messages";
const props = defineProps<{ boardId: number; tasks: readonly Task[] }>();
const emit = defineEmits<{ applied: []; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "local", messages: kanbanMessages });
const runtime = useReferenceRuntime();
const api = createKanbanApi(runtime);
const fileId = `task-workbook-${useId()}`;
type ImportRow = TaskImportInput["rows"][number];
const workbookColumns = [
  { key: "title", label: "title", type: "string" },
  { key: "description", label: "description", type: "string" },
  { key: "status", label: "status", type: "string" },
  { key: "priority", label: "priority", type: "string" },
  { key: "assigneeId", label: "assigneeId", type: "number" },
  { key: "dueDate", label: "dueDate", type: "string" },
  { key: "tags", label: "tags", type: "string" },
] as const satisfies readonly ScWorkbookColumn[];
const stage = ref<ImportRow[]>([]);
const errors = ref<string[]>([]);
const error = ref("");
const success = ref("");
const busy = ref(false);
const confirmOpen = ref(false);
let epoch = 0;
let active = true;
const columns = computed<readonly ScTableColumn<ImportRow>[]>(() => [
  { id: "row", label: t("kanban.row"), value: (row) => row.rowNumber },
  { id: "title", label: t("kanban.titleField"), value: (row) => row.input.title },
  { id: "status", label: t("kanban.status"), value: (row) => row.input.status },
  { id: "date", label: t("kanban.date"), value: (row) => row.input.dueDate ?? "—" },
]);
const rowKey = (row: ImportRow) => String(row.rowNumber);
function readTags(value: unknown): unknown {
  if (value === null || value === "") return [];
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
watch(
  () => stage.value.length,
  (count) => emit("dirty-change", count > 0),
);
watch(() => props.boardId, discard);
function discard() {
  epoch++;
  busy.value = false;
  stage.value = [];
  errors.value = [];
  error.value = "";
  confirmOpen.value = false;
}
async function readFile(event: Event) {
  if (busy.value) return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const requestEpoch = ++epoch;
  busy.value = true;
  error.value = "";
  errors.value = [];
  success.value = "";
  stage.value = [];
  try {
    const result = await readWorkbook(await file.arrayBuffer(), {
      columns: workbookColumns,
      limits: { maxRows: 10000 },
    });
    if (!active || requestEpoch !== epoch) return;
    errors.value = result.errors.map(
      (issue) => `${t("kanban.row")} ${issue.row} ${issue.column ?? ""}: ${issue.message}`,
    );
    const accepted: ImportRow[] = [];
    result.rows.forEach((row, index) => {
      const parsed = taskSchema.safeParse({
        title: row.title ?? "",
        description: row.description ?? "",
        status: row.status ?? "",
        priority: row.priority ?? "",
        assigneeId: row.assigneeId === null ? "" : String(row.assigneeId),
        dueDate: row.dueDate ?? "",
        tags: readTags(row.tags),
      });
      const rowNumber = result.sourceRowNumbers[index]!;
      if (parsed.success) accepted.push({ rowNumber, input: parsed.data });
      else
        errors.value.push(
          ...parsed.error.issues.map(
            (issue) => `${t("kanban.row")} ${rowNumber} ${issue.path.join(".")}: ${issue.message}`,
          ),
        );
    });
    if (!accepted.length || accepted.length > 200) errors.value.push(t("kanban.importInvalid"));
    stage.value = accepted;
  } catch (failure) {
    if (active && requestEpoch === epoch)
      error.value = failure instanceof Error ? failure.message : t("kanban.error");
  } finally {
    if (active && requestEpoch === epoch) busy.value = false;
  }
}
async function persist() {
  if (busy.value || errors.value.length || !stage.value.length) return;
  busy.value = true;
  error.value = "";
  const requestEpoch = epoch;
  try {
    const result = await api.importTasks({ boardId: props.boardId, rows: stage.value });
    if (!active || requestEpoch !== epoch) return;
    success.value = `${t("kanban.imported")}: ${result.importedCount}`;
    stage.value = [];
    confirmOpen.value = false;
    emit("applied");
  } catch (failure) {
    if (!active || requestEpoch !== epoch) return;
    error.value = failure instanceof Error ? failure.message : t("kanban.error");
    if (failure instanceof ApiError)
      errors.value = Object.entries(failure.fields).map(([field, message]) => {
        const match = /^rows\[(\d+)\]\.input\.(.+)$/.exec(field);
        return match
          ? `${t("kanban.row")} ${stage.value[Number(match[1])]?.rowNumber ?? "?"} ${match[2]}: ${message}`
          : `${field}: ${message}`;
      });
  } finally {
    if (active && requestEpoch === epoch) busy.value = false;
  }
}
const downloadUrls = new Set<string>();
const downloadTimers = new Set<number>();
async function download(template: boolean) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const bytes = await writeWorkbook({
      columns: workbookColumns,
      rows: template
        ? [
            {
              title: "Example",
              description: "",
              status: "TODO",
              priority: "MEDIUM",
              assigneeId: null,
              dueDate: "0000-02-29",
              tags: "[]",
            },
          ]
        : props.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assigneeId,
            dueDate: task.dueDate,
            tags: JSON.stringify(task.tags),
          })),
      sheetName: "Tasks",
    });
    if (!active) return;
    const url = URL.createObjectURL(
      new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    downloadUrls.add(url);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = template ? "tasks-template.xlsx" : "tasks.xlsx";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      downloadUrls.delete(url);
      downloadTimers.delete(timer);
    }, 0);
    downloadTimers.add(timer);
  } catch (failure) {
    if (active) error.value = failure instanceof Error ? failure.message : t("kanban.error");
  } finally {
    if (active) busy.value = false;
  }
}
onBeforeUnmount(() => {
  active = false;
  epoch++;
  for (const timer of downloadTimers) window.clearTimeout(timer);
  for (const url of downloadUrls) URL.revokeObjectURL(url);
  downloadTimers.clear();
  downloadUrls.clear();
});
</script>
