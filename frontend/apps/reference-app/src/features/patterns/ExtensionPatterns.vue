<template>
  <div class="sc-stack">
    <sc-section-card :title="t('app.chart')">
      <div class="sc-actions">
        <sc-action-button @click="changeChartData">{{ t("app.changeData") }}</sc-action-button>
        <sc-action-button
          variant="outlined"
          @click="chartType = chartType === 'bar' ? 'line' : 'bar'"
        >
          {{ t(chartType === "bar" ? "app.lineChart" : "app.barChart") }}
        </sc-action-button>
      </div>
      <sc-chart
        :type="chartType"
        :data="chartData"
        :label="t('app.chart')"
        :summary="t('app.chartSummary')"
        :data-title="t('common.chart.dataTitle')"
        :empty-label="t('common.chart.noData')"
        :category-label="t('app.name')"
        :value-label="t('app.amount')"
        :loading-label="t('common.states.loading')"
        :retry-label="t('common.actions.retry')"
        :invalid-data-label="t('common.states.error')"
        selectable
        :select-label="t('app.selectDatum')"
        @select="selectedChartLabel = $event.label"
      />
      <p v-if="selectedChartLabel" role="status">
        {{ t("app.selectedDatum") }}: {{ selectedChartLabel }}
      </p>
    </sc-section-card>
    <sc-section-card :title="t('app.editor')">
      <sc-rich-text-editor
        v-model="document"
        :label="t('app.editor')"
        :toolbar-labels="editorLabels"
      />
      <details class="extension-patterns__document">
        <summary>JSON</summary>
        <pre
          class="extension-patterns__json"
          tabindex="0"
          role="region"
          :aria-label="`${t('app.editor')} JSON`"
          >{{ JSON.stringify(document, null, 2) }}</pre>
      </details>
    </sc-section-card>
    <sc-section-card :title="t('app.excel')">
      <p>{{ t("app.excelScope") }}</p>
      <div class="sc-actions">
        <sc-action-button :busy="exporting" @click="downloadWorkbook">
          {{ t("common.excel.export") }} ({{ excelRows.length }})
        </sc-action-button>
        <label class="extension-patterns__file">
          {{ t("app.excelFile") }}
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx"
            :aria-label="t('app.excelFile')"
            @change="previewWorkbook"
          />
        </label>
      </div>
      <sc-error-panel v-if="excelError" :message="excelError" :show-retry="false" />
      <div v-if="stagedRows" class="sc-stack">
        <p role="status">{{ t("app.staged") }}: {{ stagedRows.length }}</p>
        <ul v-if="importErrors.length">
          <li v-for="(error, index) in importErrors" :key="index">
            {{ error.row }} · {{ error.message }}
          </li>
        </ul>
        <div class="sc-actions">
          <sc-action-button :disabled="importErrors.length > 0" @click="applyWorkbook">
            {{ t("app.apply") }}
          </sc-action-button>
          <sc-action-button variant="outlined" @click="cancelImport">
            {{ t("app.clear") }}
          </sc-action-button>
        </div>
      </div>
      <table class="extension-patterns__table">
        <caption>{{ t("app.excel") }} ({{ excelRows.length }})</caption>
        <thead>
          <tr>
            <th v-for="column in excelColumns" :key="column.key" scope="col">
              {{
                column.key === "date"
                  ? "UTC"
                  : t(
                      column.key === "name"
                        ? "app.name"
                        : column.key === "amount"
                          ? "app.amount"
                          : "app.description",
                    )
              }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in excelRows" :key="index">
            <td v-for="column in excelColumns" :key="column.key">
              {{ formatCell(row[column.key]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </sc-section-card>
  </div>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 파일 선택은 stagedRows에 미리보기만 만든다. 검증 오류가 없을 때 적용 버튼으로 표시 자료를 교체한다.
 */

/**
 * 차트·구조화 문서 편집·XLSX 읽기/쓰기를 공통 패키지로 조합한 로컬 예제다. 서버 저장이나 업무 권한을 제공하지 않는다.
 * 차트는 불변 배열 교체, 에디터는 문서 JSON v-model, Excel은 읽기→검증 결과 미리보기→명시적 적용으로 상태 변경을 나눈다.
 * Record<ExcelKey, ScExcelCell>은 정해진 열 키의 맵 타입이다. 파일의 실제 셀 값은 readWorkbook의 런타임 검증 결과로 확인한다.
 * operation은 파일 읽기 순번이다. 늦게 끝난 이전 읽기가 새 선택을 덮지 않게 비교하고 unmount에서 URL/timer를 정리한다.
 */

import { computed, ref, shallowRef, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { ScSectionCard, ScActionButton, ScErrorPanel } from "@sc/ui";
import { ScChart, type ScChartDatum } from "@sc/ui/charts";
import { ScRichTextEditor, type ScRichTextDocument } from "@sc/ui/editor";
import {
  writeWorkbook,
  readWorkbook,
  type ScWorkbookColumn,
  type ScExcelCell,
  type ScWorkbookError,
} from "@sc/excel";
const { t } = useI18n({ useScope: "global" });
const chartType = ref<"bar" | "line">("bar");
const selectedChartLabel = ref("");
const chartData = shallowRef<readonly ScChartDatum[]>([
  { label: "A", value: 12 },
  { label: "B", value: 24 },
  { label: "C", value: 18 },
]);
function changeChartData() {
  chartData.value = chartData.value.map((item) => ({ ...item, value: item.value + 5 }));
}
const document = ref<ScRichTextDocument>({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "서식 입력 예제" }] }],
});
const editorLabels = computed(() => ({
  bold: t("common.editor.bold"),
  italic: t("common.editor.italic"),
  bulletList: t("common.editor.bulletList"),
  undo: t("common.editor.undo"),
  redo: t("common.editor.redo"),
}));
type ExcelKey = "name" | "amount" | "date" | "note";
type ExcelRow = Record<ExcelKey, ScExcelCell>;
const excelColumns: readonly ScWorkbookColumn<ExcelKey>[] = [
  { key: "name", label: "Name", type: "string" },
  { key: "amount", label: "Quantity", type: "number" },
  { key: "date", label: "UTC", type: "date" },
  { key: "note", label: "Note", type: "string" },
];
const excelRows = shallowRef<readonly ExcelRow[]>([
  { name: "한글 예제", amount: 3, date: new Date("2026-01-01T00:00:00.000Z"), note: null },
  { name: "수식 모양 문자열", amount: 2, date: null, note: "=SUM(1,2)" },
  { name: "세 번째", amount: 1, date: null, note: "실제 문자열" },
]);
const stagedRows = shallowRef<ExcelRow[] | null>(null);
const importErrors = ref<ScWorkbookError[]>([]);
const excelError = ref("");
const exporting = ref(false);
const fileInput = ref<HTMLInputElement>();
let operation = 0;
let disposed = false;
const urls = new Map<string, ReturnType<typeof setTimeout>>();
function formatCell(value: ScExcelCell) {
  return value instanceof Date ? value.toISOString() : (value ?? "");
}
/**
 * 현재 열/행으로 workbook bytes를 만든 뒤 Blob URL로 다운로드한다. document라는 에디터 변수와 구분하여 globalThis.document를 사용한다.
 */
async function downloadWorkbook() {
  if (exporting.value) return;
  exporting.value = true;
  excelError.value = "";
  try {
    const buffer = await writeWorkbook({
      columns: excelColumns,
      rows: excelRows.value,
      sheetName: "Examples",
    });
    if (disposed) return;
    const url = URL.createObjectURL(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const link = globalThis.document.createElement("a");
    link.href = url;
    link.download = "sc-examples.xlsx";
    link.click();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      urls.delete(url);
    }, 0);
    urls.set(url, timer);
  } catch (error) {
    excelError.value = error instanceof Error ? error.message : String(error);
  } finally {
    exporting.value = false;
  }
}
/**
 * 파일 크기를 먼저 확인하고 비동기 읽기/파싱 전후에 작업 순번을 검사한다. 파싱 결과의 rows와 errors를 함께 보관한다.
 */
async function previewWorkbook(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const id = ++operation;
  stagedRows.value = null;
  importErrors.value = [];
  excelError.value = "";
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error("XLSX 최대 10 MiB");
    const bytes = await file.arrayBuffer();
    if (id !== operation || disposed) return;
    const parsed = await readWorkbook(bytes, {
      columns: excelColumns,
      sheetName: "Examples",
    });
    if (id !== operation) return;
    stagedRows.value = parsed.rows;
    importErrors.value = parsed.errors;
  } catch (error) {
    if (id === operation) excelError.value = error instanceof Error ? error.message : String(error);
  }
}
/**
 * 검증 오류가 없는 미리보기만 현재 표에 반영한다. 적용 후 파일 input도 초기화하여 같은 파일을 다시 선택할 수 있게 한다.
 */
function applyWorkbook() {
  if (!stagedRows.value || importErrors.value.length) return;
  excelRows.value = stagedRows.value;
  cancelImport();
}
function cancelImport() {
  operation++;
  stagedRows.value = null;
  importErrors.value = [];
  if (fileInput.value) fileInput.value.value = "";
}
onBeforeUnmount(() => {
  disposed = true;
  operation++;
  for (const [url, timer] of urls) {
    clearTimeout(timer);
    URL.revokeObjectURL(url);
  }
  urls.clear();
});
</script>
<style scoped lang="scss">
.extension-patterns__document summary {
  min-height: 32px;
  min-width: 44px;
  display: list-item;
  line-height: 32px;
  width: fit-content;
}
.extension-patterns__json {
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.extension-patterns__file {
  display: grid;
  gap: var(--sc-space-2);
}
.extension-patterns__table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--sc-space-4);
}
th,
td {
  text-align: start;
  padding: var(--sc-space-2);
  border-bottom: 1px solid var(--sc-color-border);
  overflow-wrap: anywhere;
}
</style>
