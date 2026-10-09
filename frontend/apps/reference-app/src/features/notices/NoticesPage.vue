<template>
  <section class="sc-content sc-stack">
    <sc-page-header :title="t('notice.list')">
      <template #actions>
        <sc-action-button
          :disabled="busy || listQuery.isError.value"
          @click="runtime.router.push('/notices/new')"
        >
          {{ t("notice.new") }}
        </sc-action-button>
      </template>
    </sc-page-header>
    <sc-section-card :title="t('notice.search')">
      <form class="notice-search" @submit.prevent="applySearch">
        <sc-text-field v-model="search" :label="t('notice.search')" :max-length="200" />
        <sc-action-button type="submit">{{ t("notice.apply") }}</sc-action-button>
      </form>
    </sc-section-card>
    <sc-section-card :title="t('notice.list')">
      <sc-data-table
        :rows="listQuery.data.value ?? []"
        :columns="columns"
        :caption="t('notice.list')"
        :get-row-key="rowKey"
        :get-row-label="rowLabel"
        :loading="listQuery.isPending.value"
        :error="
          listQuery.isError.value
            ? (listQuery.error.value?.message ?? t('notice.operationError'))
            : ''
        "
        @retry="listQuery.refetch()"
      >
        <template #row-actions="{ row }">
          <router-link :to="`/notices/${row.id}`" :aria-label="`${t('notice.open')}: ${row.title}`">
            {{ t("notice.open") }}
          </router-link>
        </template>
      </sc-data-table>
    </sc-section-card>
    <!-- v-if는 선택 상태에 따라 편집 영역을 생성/제거한다. 조회 실패와 저장 오류는 서로 다른 상태로 표시한다. -->
    <template v-if="editing">
      <p v-if="detailQuery.isPending.value && selectedId" role="status">
        {{ t("notice.loading") }}
      </p>
      <v-alert v-if="detailQuery.isError.value && selectedId" type="error" role="alert">
        {{ detailQuery.error.value?.message }}
        <sc-action-button @click="detailQuery.refetch()">{{ t("notice.retry") }}</sc-action-button>
      </v-alert>
      <v-alert v-if="error" type="error" role="alert">{{ error }}</v-alert>
      <v-alert v-if="conflict" type="warning" role="alert">{{ t("notice.conflict") }}</v-alert>
      <p v-if="notice" role="status">{{ notice }}</p>
      <sc-section-card
        v-if="source || (isNew && !listQuery.isError.value)"
        :title="t('notice.detail')"
        :description="source ? `${t('notice.basis')} ${source.revision}` : ''"
      >
        <p v-if="readonly">{{ t("notice.readonly") }}</p>
        <!-- initial/reset-key는 아래 방향, save/dirty-change는 위 방향 데이터 흐름이다. 자식은 props를 직접 바꾸지 않는다. -->
        <notice-form
          :initial="source"
          :reset-key="resetKey"
          :busy="busy"
          :readonly="readonly"
          :server-errors="serverErrors"
          @save="saveRecord"
          @dirty-change="dirty = $event"
        />
        <div class="record-actions">
          <sc-action-button v-if="source" :disabled="busy" variant="outlined" @click="reloadRecord">
            {{ t("notice.reload") }}
          </sc-action-button>
          <sc-action-button
            v-if="source && !readonly"
            :disabled="busy"
            variant="text"
            @click="askDelete"
          >
            {{ t("notice.remove") }}
          </sc-action-button>
        </div>
      </sc-section-card>
    </template>
    <!-- v-model로 확인창 열림 상태를 연결한다. confirm/cancel 이벤트가 guard의 대기 Promise를 완료한다. -->
    <sc-confirm-dialog
      v-model="guard.open.value"
      :title="t('notice.confirmTitle')"
      :message="t(`notice.${guard.message.value || 'leave'}`)"
      :confirm-label="t('notice.continue')"
      :cancel-label="t('notice.cancel')"
      @confirm="guard.finish(true)"
      @cancel="guard.finish(false)"
    />
    <sc-confirm-dialog
      v-model="deleteOpen"
      :title="t('notice.confirmTitle')"
      :message="t('notice.deleteConfirm')"
      :busy="busy"
      intent="danger"
      :confirm-label="t('notice.remove')"
      :cancel-label="t('notice.cancel')"
      @confirm="deleteRecord"
      @cancel="deleteOpen = false"
    />
  </section>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 공지 목록과 URL로 선택한 상세 편집을 한 화면에 배치한다. :prop은 JS 값 전달, @event는 자식 이벤트 처리다.
 */

// 공지 화면의 조정자: Router가 선택 ID를, Vue Query가 서버 응답을, 자식 Form이 저장 전 입력을 소유한다.
// ref는 브라우저의 반응형 상태다. computed는 의존 값이 바뀔 때 다시 계산하므로 같은 정보를 별도 상태에 복제하지 않는다.
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { noticeScopedMessages } from "./messages";
import { ApiError } from "@sc/runtime";
import { createDateFormatter } from "@sc/date";
import { ScActionButton, ScConfirmDialog, ScPageHeader, ScSectionCard, ScTextField } from "@sc/ui";
import { ScDataTable, type ScTableColumn } from "@sc/ui/table";
import { useReferenceRuntime } from "../../auth/identity";
import { useDraftGuard } from "../../shared/useDraftGuard";
import { createNoticesApi, type NoticeResponse } from "./api";
import { noticeKeys } from "./query";
import type { NoticeDraft } from "./schema";
import NoticeForm from "./NoticeForm.vue";
const runtime = useReferenceRuntime();
const route = useRoute();
const api = createNoticesApi(runtime);
const { t, locale } = useI18n({ useScope: "local", messages: noticeScopedMessages });
// URL params는 문자열이므로 양의 안전한 정수로 해석한다. 유효 ID가 없으면 상세 Query를 켜지 않는다.
const selectedId = computed(() => {
  const value = Number(route.params.id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
});
const isNew = computed(() => route.path === "/notices/new");
const editing = computed(() => isNew.value || selectedId.value !== null);
const q = computed(() => (typeof route.query.q === "string" ? route.query.q.slice(0, 200) : ""));
// queryKey는 캐시 주소이고 queryFn은 실제 GET이다. Query 내부 ref는 template에서도 listQuery.data.value처럼 읽는다.
const listQuery = useQuery({
  queryKey: computed(() => noticeKeys.list(q.value)),
  queryFn: ({ queryKey, signal }) => api.list(queryKey[2], signal),
  enabled: computed(() => !!runtime.session.identity),
});
// 상세 ID별 캐시와 취소 signal을 사용한다. !는 enabled 조건을 근거로 한 TS 단언이며 런타임 검증을 추가하지 않는다.
const detailQuery = useQuery({
  queryKey: computed(() => noticeKeys.detail(selectedId.value)),
  queryFn: ({ queryKey, signal }) => api.detail(queryKey[2]!, signal),
  enabled: computed(() => !!runtime.session.identity && selectedId.value !== null),
});
const view = computed(() =>
  detailQuery.data.value?.id === selectedId.value ? detailQuery.data.value : null,
);
// 폼의 편집 시작 입력/revision 기준이다. Query 재조회는 입력 초기화 사유가 아니다.
// shallowRef<T|null>는 객체 내부를 깊게 추적하지 않고 참조 교체를 추적한다. 여기서는 편집 시작 DTO/revision 기준이다.
const source = shallowRef<NoticeResponse | null>(null);
const resetKey = ref(0);
const dirty = ref(false);
const busy = ref(false);
const error = ref("");
const notice = ref("");
const conflict = ref(false);
const serverErrors = ref<Record<string, string>>({});
const deleteOpen = ref(false);
const readonly = computed(
  () => !!source.value && source.value.authorId !== runtime.session.identity?.id,
);
const guard = useDraftGuard(computed(() => !!runtime.session.identity && dirty.value));
let epoch = 0;
let disposed = false;
// 명시적으로 입력 기준을 교체하고 resetKey를 올려 자식 폼의 resetForm을 유도한다. 저장 실패 경로에서는 호출하지 않는다.
function initialize(item: NoticeResponse | null) {
  source.value = item;
  resetKey.value++;
  dirty.value = false;
  serverErrors.value = {};
  conflict.value = false;
}
// 선택 경로가 바뀌면 epoch를 증가시킨다. 이전 경로에서 시작한 비동기 저장/조회가 새 폼을 변경하지 못하게 하는 기준이다.
watch(
  () => route.path,
  () => {
    epoch++;
    initialize(null);
    busy.value = false;
    error.value = "";
    notice.value = "";
    deleteOpen.value = false;
  },
  { immediate: true },
);
// 최초 상세가 도착한 경우만 폼을 채운다. 이후 Query의 자동 재조회는 편집 중인 source를 교체하지 않는다.
watch(
  view,
  (item) => {
    if (item && !source.value) initialize(item);
  },
  { immediate: true },
);
// 화면 제거 시 응답 소유권을 무효화한다. await 중인 작업이 늦게 끝나도 제거된 화면 상태를 적용하지 않는다.
onBeforeUnmount(() => {
  disposed = true;
  epoch++;
});
// 현재 선택 epoch와 공통 client의 세션 generation을 캡처한 검사 함수를 반환한다. await 뒤 owns()로 선택/로그인 주체가 그대로인지 확인한다.
function capture() {
  const selection = epoch;
  const generation = runtime.client.getGeneration();
  return () =>
    !disposed &&
    epoch === selection &&
    generation === runtime.client.getGeneration() &&
    !!runtime.session.identity;
}
// catch의 unknown은 어떤 값이든 올 수 있다는 타입이다. instanceof로 Error/ApiError를 좁혀 메시지·필드 오류·409 충돌을 구분한다.
function showFailure(cause: unknown) {
  error.value = cause instanceof Error ? cause.message : t("notice.operationError");
  if (cause instanceof ApiError) {
    serverErrors.value = { ...cause.fields };
    if (cause.status === 409) conflict.value = true;
  }
}
// 저장 성공 DTO를 상세 캐시에 직접 넣고 목록 접두사를 무효화한다. invalidateQueries는 서버 데이터 재조회이며 DB 트랜잭션이 아니다.
function record(item: NoticeResponse) {
  runtime.queryClient.setQueryData(noticeKeys.detail(item.id), item);
  void runtime.queryClient.invalidateQueries({ queryKey: noticeKeys.lists });
}
// 자식 save 이벤트 → API create/save → 응답 소유권 확인 → Query 갱신 → 폼 기준 초기화 순서다.
// 수정에는 source의 revision을 보낸다. await는 브라우저를 막는 Java 동기 호출이 아니라 Promise 완료를 기다리는 비동기 흐름이다.
async function saveRecord(draft: NoticeDraft) {
  if (busy.value || readonly.value) return;
  const owns = capture();
  const id = selectedId.value;
  const revision = source.value?.revision;
  busy.value = true;
  error.value = "";
  notice.value = "";
  serverErrors.value = {};
  try {
    const input = draft;
    const saved = id
      ? await api.save(id, { ...input, revision: revision! })
      : await api.create(input);
    if (!owns()) return;
    record(saved);
    initialize(saved);
    notice.value = t("notice.saved");
    if (!id) await runtime.router.replace(`/notices/${saved.id}`);
  } catch (cause) {
    if (owns()) showFailure(cause);
  } finally {
    if (owns()) busy.value = false;
  }
}
// 사용자가 최신 조회를 선택하면 dirty 입력 폐기를 확인한다. GET 성공 및 owns() 통과 후에만 입력/revision을 교체한다.
async function reloadRecord() {
  if (busy.value || !selectedId.value) return;
  const owns = capture();
  const id = selectedId.value;
  if (dirty.value && !(await guard.confirm("discard"))) return;
  if (!owns()) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    const latest = await api.detail(id);
    if (!owns()) return;
    record(latest);
    initialize(latest);
  } catch (cause) {
    if (owns()) showFailure(cause);
  } finally {
    if (owns()) busy.value = false;
  }
}
// 미저장 입력 경고와 실제 삭제 확인은 별도 단계다. 먼저 입력 폐기에 동의한 뒤 삭제 모달을 연다.
async function askDelete() {
  if (busy.value || readonly.value || !source.value) return;
  const owns = capture();
  if (dirty.value && !(await guard.confirm("deleteDirty"))) return;
  if (owns()) deleteOpen.value = true;
}
// 삭제 확인 이벤트에서 현재 revision을 전송한다. 성공하면 상세 캐시 제거·목록 갱신·목록 URL 이동을 수행한다.
async function deleteRecord() {
  if (busy.value || readonly.value || !source.value) return;
  const owns = capture();
  const { id, revision } = source.value;
  busy.value = true;
  error.value = "";
  try {
    await api.remove(id, revision);
    if (!owns()) return;
    deleteOpen.value = false;
    runtime.queryClient.removeQueries({ queryKey: noticeKeys.detail(id), exact: true });
    void runtime.queryClient.invalidateQueries({ queryKey: noticeKeys.lists });
    initialize(null);
    await runtime.router.replace("/notices");
  } catch (cause) {
    if (owns()) {
      deleteOpen.value = false;
      showFailure(cause);
    }
  } finally {
    if (owns()) busy.value = false;
  }
}
const formatter = computed(() =>
  createDateFormatter({ locale: locale.value === "en" ? "en" : "ko", timeZone: "Asia/Seoul" }),
);
// ScTableColumn<T>의 T는 행 DTO 타입이다. value 함수는 표시 문자열만 만들며 서버 DTO나 UTC 원문을 변경하지 않는다.
const columns = computed<readonly ScTableColumn<NoticeResponse>[]>(() => [
  { id: "title", label: t("notice.title"), value: (row) => row.title },
  { id: "author", label: t("notice.author"), value: (row) => row.authorName },
  {
    id: "updatedAt",
    label: t("notice.updatedAt"),
    value: (row) => formatter.value.formatTimestamp(row.updatedAt),
  },
]);
const rowKey = (row: NoticeResponse) => String(row.id);
const rowLabel = (row: NoticeResponse) => row.title;
// 검색창의 미적용 입력은 로컬 ref, 실제 조회 q는 Router query가 원본이다. watch(q)가 뒤로 가기/외부 URL 변화도 입력에 반영한다.
const search = ref("");
watch(
  q,
  (value) => {
    search.value = value;
  },
  { immediate: true },
);
// 검색 제출은 직접 list()를 호출하지 않고 URL을 교체한다. q computed와 Query key가 바뀌어 자동으로 맞는 조회가 실행된다.
async function applySearch() {
  await runtime.router.replace({ query: search.value ? { q: search.value } : {} });
}
</script>
<style scoped>
.record-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sc-space-3);
  margin-top: var(--sc-space-4);
}
.notice-search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sc-space-4);
}
</style>
