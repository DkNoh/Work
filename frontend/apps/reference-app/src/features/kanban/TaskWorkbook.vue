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
    <!-- 미리보기는 stage만 표시한다. 반영 버튼은 확인 모달만 열며 실제 API는 모달 @confirm의 persist에서 실행된다. -->
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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 파일 선택 → 브라우저 파싱/검증 → 미리보기 → 확인창 → 서버 반영을 구분한다. 파일을 고르는 것만으로 작업이 저장되지 않는다.
 */

// 칸반 Excel 입출력 UI다. @sc/excel이 XLSX 형식을 처리하고 taskSchema가 업무 입력을 검증하며 api.importTasks가 실제 서버 저장을 담당한다.
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
// 내보내기는 부모가 현재 조회한 tasks만 사용한다. 전체 서버 목록을 몰래 추가 조회하는 경로가 아니다.
const props = defineProps<{ boardId: number; tasks: readonly Task[] }>();
const emit = defineEmits<{ applied: []; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "local", messages: kanbanMessages });
const runtime = useReferenceRuntime();
const api = createKanbanApi(runtime);
const fileId = `task-workbook-${useId()}`;
// TaskImportInput["rows"][number]는 rows 배열의 요소 타입을 꺼낸다. 행 번호와 입력을 함께 보존하는 가져오기 DTO다.
type ImportRow = TaskImportInput["rows"][number];
// 열 key/자료형은 XLSX 읽기/쓰기 공통 계약이다. as const는 좁은 리터럴 타입, satisfies는 구조 검사이며 런타임 변환을 하지 않는다.
const workbookColumns = [
  { key: "title", label: "title", type: "string" },
  { key: "description", label: "description", type: "string" },
  { key: "status", label: "status", type: "string" },
  { key: "priority", label: "priority", type: "string" },
  { key: "assigneeId", label: "assigneeId", type: "number" },
  { key: "dueDate", label: "dueDate", type: "string" },
  { key: "tags", label: "tags", type: "string" },
] as const satisfies readonly ScWorkbookColumn[];
// stage는 검증을 통과한 미반영 행이다. 오류가 하나라도 있거나 행 수가 범위를 벗어나면 persist 버튼/핸들러가 반영을 막는다.
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
// tags 셀은 쉼표 분리 문자열이 아니라 JSON 배열이다. unknown으로 읽고 뒤의 Zod 스키마가 실제 문자열 배열인지 검사한다.
function readTags(value: unknown): unknown {
  if (value === null || value === "") return [];
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
// 미반영 행이 있으면 부모의 이탈 보호에 dirty=true를 알린다. 보드가 바뀌면 discard로 이전 미리보기를 무효화한다.
watch(
  () => stage.value.length,
  (count) => emit("dirty-change", count > 0),
);
watch(() => props.boardId, discard);
// epoch를 올려 진행 중 파일 파싱의 결과도 무시한다. 로컬 미리보기/오류/확인창만 지우며 서버 삭제 요청은 하지 않는다.
function discard() {
  epoch++;
  busy.value = false;
  stage.value = [];
  errors.value = [];
  error.value = "";
  confirmOpen.value = false;
}
// native change 이벤트의 target은 EventTarget일 수 있으므로 HTMLInputElement인지 좁힌다.
// 같은 파일을 다시 선택할 수 있게 input.value를 비운 뒤 ArrayBuffer로 XLSX를 읽고 현재 epoch일 때만 결과를 반영한다.
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
    // 각 행의 형식을 taskSchema.safeParse로 검사한다. sourceRowNumbers로 원본 물리 행을 보존해 빈 행/오류 행 이후에도 정확한 위치를 안내한다.
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
// 명시적 확인 이벤트에서만 import API를 호출한다. 성공이면 stage를 비우고 applied 이벤트로 부모 Query 갱신을 요청한다.
// 실패 시 stage를 보존하며 서버 필드 경로의 배열 인덱스를 원본 Excel rowNumber로 되돌려 표시한다.
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
// Object URL은 브라우저가 Blob 메모리를 붙잡는 임시 주소다. 다운로드 후와 화면 제거 시 모두 revoke하도록 URL/timer를 추적한다.
const downloadUrls = new Set<string>();
const downloadTimers = new Set<number>();
// 템플릿 또는 현재 조회 작업을 writeWorkbook으로 변환해 Blob 다운로드를 만든다. tags는 JSON 문자열로 저장해 태그 안 쉼표를 보존한다.
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
// 화면 제거 시 비동기 결과를 무효화하고 남은 timer/Object URL을 해제한다. 서버 세션 종료나 파일 삭제 동작은 아니다.
onBeforeUnmount(() => {
  active = false;
  epoch++;
  for (const timer of downloadTimers) window.clearTimeout(timer);
  for (const url of downloadUrls) URL.revokeObjectURL(url);
  downloadTimers.clear();
  downloadUrls.clear();
});
</script>
