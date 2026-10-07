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
const selectedId = computed(() => {
  const value = Number(route.params.id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
});
const isNew = computed(() => route.path === "/notices/new");
const editing = computed(() => isNew.value || selectedId.value !== null);
const q = computed(() => (typeof route.query.q === "string" ? route.query.q.slice(0, 200) : ""));
const listQuery = useQuery({
  queryKey: computed(() => noticeKeys.list(q.value)),
  queryFn: ({ queryKey, signal }) => api.list(queryKey[2], signal),
  enabled: computed(() => !!runtime.session.identity),
});
const detailQuery = useQuery({
  queryKey: computed(() => noticeKeys.detail(selectedId.value)),
  queryFn: ({ queryKey, signal }) => api.detail(queryKey[2]!, signal),
  enabled: computed(() => !!runtime.session.identity && selectedId.value !== null),
});
const view = computed(() =>
  detailQuery.data.value?.id === selectedId.value ? detailQuery.data.value : null,
);
// 폼의 편집 시작 입력/revision 기준이다. Query 재조회는 입력 초기화 사유가 아니다.
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
function initialize(item: NoticeResponse | null) {
  source.value = item;
  resetKey.value++;
  dirty.value = false;
  serverErrors.value = {};
  conflict.value = false;
}
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
watch(
  view,
  (item) => {
    if (item && !source.value) initialize(item);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  disposed = true;
  epoch++;
});
function capture() {
  const selection = epoch;
  const generation = runtime.client.getGeneration();
  return () =>
    !disposed &&
    epoch === selection &&
    generation === runtime.client.getGeneration() &&
    !!runtime.session.identity;
}
function showFailure(cause: unknown) {
  error.value = cause instanceof Error ? cause.message : t("notice.operationError");
  if (cause instanceof ApiError) {
    serverErrors.value = { ...cause.fields };
    if (cause.status === 409) conflict.value = true;
  }
}
function record(item: NoticeResponse) {
  runtime.queryClient.setQueryData(noticeKeys.detail(item.id), item);
  void runtime.queryClient.invalidateQueries({ queryKey: noticeKeys.lists });
}
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
async function askDelete() {
  if (busy.value || readonly.value || !source.value) return;
  const owns = capture();
  if (dirty.value && !(await guard.confirm("deleteDirty"))) return;
  if (owns()) deleteOpen.value = true;
}
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
const search = ref("");
watch(
  q,
  (value) => {
    search.value = value;
  },
  { immediate: true },
);
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
