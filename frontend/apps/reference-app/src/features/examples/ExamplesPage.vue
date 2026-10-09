<template>
  <section class="sc-content sc-stack examples-page">
    <sc-page-header
      title="예제 목록"
      subtitle="저장과 조회의 기본 흐름을 확인하는 중립 예제입니다."
      eyebrow="레퍼런스 / 예제"
    >
      <template #actions>
        <sc-action-button @click="startNewExample">새 예제 작성</sc-action-button>
      </template>
    </sc-page-header>
    <v-alert v-if="notice" type="success" role="status">{{ notice }}</v-alert>
    <sc-list-detail-layout
      :detail-visible="!!selected || route.query.edit === 'new'"
      @show-list="cancelEdit"
    >
      <!-- 표의 rows/loading/error는 Query 결과이며 @change-pagination은 Router 변경, @retry는 같은 Query의 재조회다. -->
      <template #list>
        <sc-section-card title="목록" :description="`전체 ${query.data.value?.total ?? 0}건`">
          <sc-data-table
            :rows="query.data.value?.items ?? []"
            :columns="columns"
            caption="예제 목록"
            :get-row-key="rowKey"
            :get-row-label="rowLabel"
            data-mode="server"
            :pagination="{ pageIndex: page, pageSize: 20, total: query.data.value?.total ?? 0 }"
            :loading="query.isPending.value"
            :error="
              query.isError.value ? (query.error.value?.message ?? '조회하지 못했습니다.') : ''
            "
            @change-pagination="selectPage($event.pageIndex)"
            @retry="query.refetch()"
          >
            <template #row-actions="{ row }">
              <sc-action-button
                variant="text"
                :aria-label="`편집: ${row.title}`"
                @click="selectExample(row)"
              >
                편집
              </sc-action-button>
            </template>
          </sc-data-table>
        </sc-section-card>
      </template>
      <!-- v-model은 아직 저장되지 않은 폼 값이다. busy는 중복 제출을 막고 error-messages는 Zod/API 오류를 입력 아래에 연결한다. -->
      <template #detail>
        <div class="sc-stack">
          <sc-section-card title="새 예제">
            <form
              novalidate
              class="sc-stack"
              aria-label="예제 등록"
              @submit.prevent="createExample"
            >
              <sc-text-field
                v-model="createTitle"
                label="제목"
                :error-messages="createForm.errors.value.title"
                :disabled="creating"
                required
              />
              <v-alert v-if="createError" type="error" role="alert">{{ createError }}</v-alert>
              <sc-form-actions
                :busy="creating"
                submit-label="등록"
                busy-label="등록 중…"
                :show-cancel="false"
              />
            </form>
          </sc-section-card>
          <sc-section-card
            v-if="selected"
            title="예제 수정"
            :description="`기준 revision ${selected.revision}`"
          >
            <form novalidate class="sc-stack" aria-label="예제 수정" @submit.prevent="saveExample">
              <sc-text-field
                v-model="editTitle"
                label="제목"
                :error-messages="editForm.errors.value.title"
                :disabled="saving || reloading"
                required
              />
              <v-alert v-if="editError" type="error" role="alert">{{ editError }}</v-alert>
              <p v-if="conflict">
                작성 중인 입력을 유지했습니다. 최신 내용을 불러오면 입력이 교체됩니다.
              </p>
              <sc-form-actions
                :busy="saving || reloading"
                :busy-label="reloading ? '최신 내용 조회 중…' : '저장 중…'"
                submit-label="저장"
                cancel-label="편집 취소"
                @cancel="cancelEdit"
              >
                <template #secondary>
                  <sc-action-button
                    v-if="conflict"
                    variant="outlined"
                    :disabled="saving || reloading"
                    @click="reloadSelected"
                  >
                    최신 내용 불러오기
                  </sc-action-button>
                </template>
              </sc-form-actions>
            </form>
          </sc-section-card>
        </div>
      </template>
    </sc-list-detail-layout>
    <!-- 모달은 입력 폐기 여부만 묻는다. 확인되기 전에는 선택 교체/최신 데이터로 reset을 실행하지 않는다. -->
    <sc-confirm-dialog
      v-model="confirmationOpen"
      title="입력 변경 확인"
      :message="confirmationMessage"
      confirm-label="계속 진행"
      @confirm="finishConfirmation(true)"
      @cancel="finishConfirmation(false)"
    />
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 목록/상세 슬롯으로 서버 표와 두 입력 폼을 조립한다. scoped slot의 row는 공통 표가 현재 행 데이터를 제공한 값이다.
 */

// 가장 작은 CRUD 읽기 예제다. URL의 page/edit → computed → Query 목록 → 사용자가 선택한 폼 기준 → API → 목록 무효화 흐름을 따른다.
// 두 useForm은 신규 입력과 수정 입력을 분리한다. selected는 편집 시작 DTO/revision이며 Query 캐시를 대체하지 않는다.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { useEventListener } from "@vueuse/core";
import { ApiError, useFrameworkRuntime } from "@sc/runtime";
import {
  ScActionButton,
  ScTextField,
  ScPageHeader,
  ScSectionCard,
  ScListDetailLayout,
  ScFormActions,
  ScConfirmDialog,
} from "@sc/ui";
import { ScDataTable, type ScTableColumn } from "@sc/ui/table";
import { createExamplesApi, type ExampleEntry } from "./api";
import { exampleSchema, type ExampleInput } from "./schema";

const runtime = useFrameworkRuntime();
const route = useRoute();
const api = createExamplesApi(runtime);
// route.query는 검증된 숫자가 아니다. 안전한 0 이상 정수로 해석하고 잘못된 입력은 첫 페이지로 처리한다.
const page = computed(() => {
  const parsed = Number(route.query.page ?? 0);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
});
// 페이지를 캐시 키에 포함하고 공통 API의 GET으로 조회한다. Query의 signal은 페이지 변경 등으로 취소된 요청에 전달된다.
const query = useQuery({
  queryKey: computed(() => ["examples", page.value]),
  queryFn: ({ signal }) => api.list(page.value, signal),
  enabled: computed(() => !!runtime.session.identity),
});
// useForm<ExampleInput>의 제네릭은 필드 타입 계약이다. Java 제네릭과 유사한 용도지만 런타임 입력 검증은 아래 safeParse가 한다.
const createForm = useForm<ExampleInput>({ initialValues: { title: "" } });
const editForm = useForm<ExampleInput>({ initialValues: { title: "" } });
const [createTitle] = createForm.defineField("title");
const [editTitle] = editForm.defineField("title");
const selected = ref<ExampleEntry | null>(null);
const selectedId = computed(() => {
  const parsed = Number(route.query.edit);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
});
const creating = ref(false);
const saving = ref(false);
const reloading = ref(false);
let disposed = false;
const createError = ref("");
const editError = ref("");
const conflict = ref(false);
const notice = ref("");
const columns: readonly ScTableColumn<ExampleEntry>[] = [
  { id: "title", label: "제목", value: (row) => row.title },
  { id: "revision", label: "revision", value: (row) => row.revision },
];
const rowKey = (row: ExampleEntry) => String(row.id);
const rowLabel = (row: ExampleEntry) => row.title;
const confirmationOpen = ref(false);
const confirmationMessage = ref("");
// 확인 모달의 응답을 기다리는 Promise resolver다. @confirm/@cancel이 finishConfirmation을 호출하면 원래 핸들러가 계속 실행된다.
let resolveConfirmation: ((allowed: boolean) => void) | undefined;
function confirmInputChange(message: string): Promise<boolean> {
  if (resolveConfirmation) return Promise.resolve(false);
  confirmationMessage.value = message;
  confirmationOpen.value = true;
  return new Promise((resolve) => {
    resolveConfirmation = resolve;
  });
}
function finishConfirmation(allowed: boolean) {
  confirmationOpen.value = false;
  const resolve = resolveConfirmation;
  resolveConfirmation = undefined;
  resolve?.(allowed);
}
// 컴포넌트 제거 이후의 비동기 응답 반영을 막고, 열린 확인창의 대기를 false로 끝낸다.
onBeforeUnmount(() => {
  disposed = true;
  finishConfirmation(false);
});
async function startNewExample() {
  await runtime.router.replace({ query: { ...route.query, edit: "new" } });
}

const hasUnsavedInput = computed(
  () => !!runtime.session.identity && (createForm.meta.value.dirty || editForm.meta.value.dirty),
);

// VueUse가 해제를 관리하며 브라우저 새로고침에서도 작성 중인 입력의 유실을 알린다.
useEventListener(window, "beforeunload", (event) => {
  if (!hasUnsavedInput.value) return;
  event.preventDefault();
  event.returnValue = "";
});

onBeforeRouteLeave(() => {
  if (!hasUnsavedInput.value) return true;
  return confirmInputChange("저장하지 않은 입력이 있습니다. 화면을 이동할까요?");
});

onBeforeRouteUpdate((to, from) => {
  if (to.query.edit === from.query.edit || !editForm.meta.value.dirty) return true;
  return confirmInputChange("작성 중인 수정을 버리고 선택을 변경할까요?");
});

// 선택 ID는 URL, 편집 기준 revision과 입력은 폼이 소유한다. 재조회는 dirty 입력을 덮지 않는다.
watch(
  [selectedId, () => query.data.value?.items],
  ([id, rows]) => {
    const changed = id !== selected.value?.id;
    if (id === null) {
      selected.value = null;
      editForm.resetForm({ values: { title: "" } });
    } else if (changed) {
      const item = rows?.find((row) => row.id === id);
      if (item) {
        selected.value = { ...item };
        editForm.resetForm({ values: { title: item.title } });
      } else {
        selected.value = null;
      }
    }
    if (changed || id === null) {
      editError.value = "";
      conflict.value = false;
    }
  },
  { immediate: true },
);

// 표 페이지 이벤트는 Router만 갱신한다. URL을 원본으로 두므로 새로고침/뒤로 가기도 같은 조회를 재현한다.
async function selectPage(nextPage: number) {
  await runtime.router.replace({ query: { ...route.query, page: String(nextPage) } });
}

async function selectExample(item: ExampleEntry) {
  await runtime.router.replace({ query: { ...route.query, edit: String(item.id) } });
}

async function cancelEdit() {
  const nextQuery = { ...route.query };
  delete nextQuery.edit;
  await runtime.router.replace({ query: nextQuery });
}

// 신규 폼 제출 → safeParse → POST → 목록 invalidate → 성공 시 신규 폼 reset 순서다.
// 서버 필드 오류는 ApiError.fields.title을 폼 오류로 연결하고, 실패한 입력은 그대로 남긴다.
async function createExample() {
  if (creating.value) return;
  createError.value = "";
  notice.value = "";
  createForm.setErrors({ title: undefined });
  const parsed = exampleSchema.safeParse(createForm.values);
  if (!parsed.success) {
    createForm.setFieldError("title", parsed.error.issues[0]?.message);
    return;
  }
  creating.value = true;
  try {
    await api.create(parsed.data);
    await runtime.queryClient.invalidateQueries({ queryKey: ["examples"] });
    if (disposed) return;
    createForm.resetForm({ values: { title: "" } });
    notice.value = "예제를 등록했습니다.";
  } catch (cause) {
    if (disposed) return;
    if (cause instanceof ApiError && cause.fields.title)
      createForm.setFieldError("title", cause.fields.title);
    createError.value = cause instanceof Error ? cause.message : "등록하지 못했습니다.";
  } finally {
    creating.value = false;
  }
}

// 수정 시작 시 id/revision을 캡처한다. PUT 성공 후 목록을 갱신하되 ownsTarget()을 통과한 현재 선택만 입력을 초기화한다.
// 409는 다른 저장과 기준 버전이 충돌했다는 뜻이며 자동으로 새 revision에 덮어쓰지 않는다.
async function saveExample() {
  if (!selected.value || saving.value || reloading.value) return;
  const target = { id: selected.value.id, revision: selected.value.revision };
  const ownsTarget = () =>
    !disposed && selectedId.value === target.id && selected.value?.id === target.id;
  editError.value = "";
  notice.value = "";
  editForm.setErrors({ title: undefined });
  const parsed = exampleSchema.safeParse(editForm.values);
  if (!parsed.success) {
    editForm.setFieldError("title", parsed.error.issues[0]?.message);
    return;
  }
  saving.value = true;
  try {
    const saved = await api.save(target.id, parsed.data, target.revision);
    // 목록은 항상 무효화하지만 이전 선택의 응답을 다른 폼에 반영하지 않는다.
    await runtime.queryClient.invalidateQueries({ queryKey: ["examples"] });
    if (!ownsTarget()) return;
    selected.value = saved;
    editForm.resetForm({ values: { title: saved.title } });
    conflict.value = false;
    notice.value = "예제를 저장했습니다.";
  } catch (cause) {
    if (!ownsTarget()) return;
    if (cause instanceof ApiError && cause.fields.title)
      editForm.setFieldError("title", cause.fields.title);
    conflict.value = cause instanceof ApiError && cause.status === 409;
    editError.value = cause instanceof Error ? cause.message : "저장하지 못했습니다.";
    // 실패·충돌은 resetForm을 호출하지 않아 사용자의 입력을 유지한다.
  } finally {
    saving.value = false;
  }
}

// 충돌 후 사용자가 최신 조회를 명시적으로 요청하는 경로다. 확인창 대기 중에도 id/revision/draft가 변하지 않았는지 검사한다.
async function reloadSelected() {
  if (!selected.value || saving.value || reloading.value) return;
  const target = {
    id: selected.value.id,
    revision: selected.value.revision,
    draft: editForm.values.title,
  };
  if (!(await confirmInputChange("작성 중인 입력을 최신 서버 내용으로 교체할까요?"))) return;
  const ownsTarget = () =>
    !disposed &&
    selectedId.value === target.id &&
    selected.value?.id === target.id &&
    selected.value.revision === target.revision &&
    editForm.values.title === target.draft;
  if (!ownsTarget()) return;
  reloading.value = true;
  try {
    // 실패한 refetch의 이전 캐시를 최신 자료로 오인하지 않는다.
    const refreshed = await query.refetch({ throwOnError: true });
    if (!ownsTarget()) return;
    const current = refreshed.data?.items.find((item) => item.id === target.id);
    if (!current) {
      editError.value = "현재 페이지에서 최신 예제를 찾지 못했습니다. 다시 조회해 주세요.";
      return;
    }
    selected.value = { ...current };
    editForm.resetForm({ values: { title: current.title } });
    editError.value = "";
    conflict.value = false;
  } catch (cause) {
    if (ownsTarget())
      editError.value = cause instanceof Error ? cause.message : "최신 내용을 조회하지 못했습니다.";
    // 입력·revision·409 표시는 조회가 성공하기 전까지 유지한다.
  } finally {
    reloading.value = false;
  }
}
</script>

<style scoped lang="scss">
.examples-page {
  min-width: 0;
}
</style>
