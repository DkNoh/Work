<template>
  <section class="sc-content sc-stack" aria-labelledby="notes-title">
    <sc-page-header id="notes-title" :title="t('title')" :description="t('description')" />
    <form class="sc-stack" :aria-label="t('search')" @submit.prevent="applySearch">
      <sc-text-field v-model="searchDraft" :label="t('search')" name="q" :max-length="200" />
      <sc-action-button type="submit">{{ t("search") }}</sc-action-button>
    </form>
    <sc-error-panel
      v-if="list.isError.value"
      :message="list.error.value?.message ?? t('failed')"
      @retry="list.refetch()"
    />
    <p v-if="list.isLoading.value" role="status">{{ t("loading") }}</p>
    <p v-if="stats.data.value">
      {{ t("total") }}: {{ stats.data.value.total }} / {{ t("revision") }}:
      {{ stats.data.value.highestRevision }}
    </p>
    <ul :aria-label="t('list')">
      <li v-for="item in list.data.value?.items ?? []" :key="item.id">
        <router-link :to="{ name: 'notes', params: { id: item.id }, query: route.query }">
          {{ item.title }}
        </router-link>
        — {{ t("revision") }} {{ item.revision }}
      </li>
    </ul>
    <sc-action-button :disabled="save.isPending.value" @click="createNew">
      {{ t("new") }}
    </sc-action-button>
    <sc-section-card :title="selectedId ? t('edit') : t('new')">
      <sc-error-panel
        v-if="detail.isError.value"
        :message="detail.error.value?.message ?? t('failed')"
        @retry="detail.refetch()"
      />
      <form class="sc-stack" :aria-label="t('form')" novalidate @submit.prevent="saveNote">
        <sc-text-field
          v-model="title"
          :label="t('field')"
          name="title"
          :error-messages="form.errors.value.title"
          :disabled="save.isPending.value"
          :max-length="200"
          required
        />
        <p v-if="selectedId && basisRevision">{{ t("revision") }} {{ basisRevision }}</p>
        <p v-if="message" :role="failed ? 'alert' : 'status'">{{ message }}</p>
        <sc-form-actions
          :busy="save.isPending.value"
          :disabled="selectedId !== null && basisRevision === null"
          :submit-label="t('save')"
          :cancel-label="t('reset')"
          @cancel="resetInput"
        />
      </form>
    </sc-section-card>
  </section>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 검색과 편집은 별도 form이다. 목록 RouterLink는 선택 ID를 URL에 넣고 상세 Query 결과를 폼 초기 기준으로 사용한다.
 */

/**
 * Notes 목록/검색/생성/수정의 전체 흐름을 보여주는 생성 앱 업무 예제다. Controller→NoteService→JPA/Querydsl/MyBatis 경계를 따라 읽을 수 있다.
 * URL의 id/q는 탐색 상태, Vue Query는 서버 자료, VeeValidate는 저장 전 입력, basisRevision은 편집을 시작한 서버 수정 번호다.
 * useMutation은 저장 요청 수명/isPending을 제공한다. retry:false로 쓰기 요청을 자동 반복하지 않고 사용자의 제출을 한 번씩 처리한다.
 * satisfies는 작성한 DTO가 서버 입력 타입과 맞는지 컴파일 검사한다. 실제 빈 제목/길이는 safeParse와 서버 검증이 확인한다.
 */

import { computed, ref, watch } from "vue";
import { useRoute, onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { useI18n } from "vue-i18n";
import { useQuery, useMutation } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { useEventListener } from "@vueuse/core";
import { z } from "zod";
import { ApiError, useFrameworkRuntime } from "@sc/runtime";
import {
  ScPageHeader,
  ScTextField,
  ScActionButton,
  ScFormActions,
  ScSectionCard,
  ScErrorPanel,
} from "@sc/ui";
import { createNotesApi, noteKeys, type NoteCreateInput, type NoteUpdateInput } from "./api";
const runtime = useFrameworkRuntime();
const api = createNotesApi(runtime);
const route = useRoute();
const { t } = useI18n({
  useScope: "local",
  inheritLocale: true,
  messages: {
    ko: {
      title: "저장 예제",
      description: "새 앱이 자신의 H2 자료·권한·입력·API 계약을 소유합니다.",
      search: "제목 검색",
      list: "저장한 제목",
      new: "새 제목",
      edit: "제목 수정",
      form: "제목 입력 폼",
      field: "제목",
      save: "저장",
      reset: "초기화",
      total: "전체 건수",
      revision: "수정 번호",
      required: "제목을 입력하세요.",
      tooLong: "제목은 200자 이하여야 합니다.",
      saved: "저장했습니다.",
      failed: "처리할 수 없습니다.",
      loading: "불러오는 중",
      leave: "저장하지 않은 입력을 버릴까요?",
    },
    en: {
      title: "Notes",
      description: "This app owns its H2 data, permissions, draft and API contract.",
      search: "Search titles",
      list: "Saved notes",
      new: "New note",
      edit: "Edit note",
      form: "Note form",
      field: "Title",
      save: "Save",
      reset: "Reset",
      total: "Total",
      revision: "Revision",
      required: "Enter a title.",
      tooLong: "Use at most 200 characters.",
      saved: "Saved.",
      failed: "Unable to complete the request.",
      loading: "Loading",
      leave: "Discard the unsaved draft?",
    },
  },
});
const selectedId = computed(() => {
  const value = route.params.id;
  return typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
    ? Number(value)
    : null;
});
const q = computed(() => (typeof route.query.q === "string" ? route.query.q : ""));
const searchDraft = ref(q.value);
watch(q, (value) => {
  searchDraft.value = value;
});
const form = useForm<{ title: string }>({ initialValues: { title: "" } });
const [title] = form.defineField("title", { validateOnModelUpdate: false });
const basisRevision = ref<number | null>(null);
const message = ref("");
const failed = ref(false);
const list = useQuery({
  queryKey: computed(() => noteKeys.list(q.value)),
  queryFn: ({ signal }) => api.list(q.value, signal),
  enabled: computed(() => !!runtime.session.identity),
});
const detail = useQuery({
  queryKey: computed(() => noteKeys.detail(selectedId.value)),
  queryFn: ({ signal }) => api.detail(selectedId.value!, signal),
  enabled: computed(() => !!runtime.session.identity && selectedId.value !== null),
});
const stats = useQuery({
  queryKey: noteKeys.stats,
  queryFn: ({ signal }) => api.stats(signal),
  enabled: computed(() => !!runtime.session.identity),
});
const save = useMutation({
  retry: false,
  mutationFn: (input: { id: number | null; title: string; revision: number | null }) =>
    input.id === null
      ? api.create({ title: input.title } satisfies NoteCreateInput)
      : api.update(input.id, {
          title: input.title,
          revision: input.revision!,
        } satisfies NoteUpdateInput),
});
watch(selectedId, () => {
  form.resetForm({ values: { title: "" } });
  basisRevision.value = null;
  message.value = "";
});
/**
 * 사용자가 작성 중이지 않을 때만 현재 선택의 응답으로 입력을 채운다. 자동 재조회가 dirty 초안을 덮어쓰지 않게 한다.
 */
watch(
  detail.data,
  (item) => {
    if (item && item.id === selectedId.value && !form.meta.value.dirty) {
      form.resetForm({ values: { title: item.title } });
      basisRevision.value = item.revision;
    }
  },
  { immediate: true },
);
/**
 * 저장 중에는 이동을 막고 미저장 입력은 사용자 확인 후 버린다. 로그아웃 후에는 업무 폼 이탈 확인이 세션 종료를 막지 않는다.
 */
function allowLeave() {
  if (!runtime.session.identity) return true;
  if (save.isPending.value) return false;
  return !form.meta.value.dirty || window.confirm(t("leave"));
}
onBeforeRouteLeave(allowLeave);
onBeforeRouteUpdate((to, from) => to.params.id === from.params.id || allowLeave());
useEventListener(window, "beforeunload", (event) => {
  if (form.meta.value.dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
async function applySearch() {
  await runtime.router.replace({ query: { ...route.query, q: searchDraft.value || undefined } });
}
async function createNew() {
  await runtime.router.push({ name: "notes", params: {}, query: route.query });
}
/**
 * 사용자가 초기화를 선택했을 때 현재 서버 값/revision을 채택한다. 조회 결과가 없는 신규 화면은 빈 제목으로 돌아간다.
 */
function resetInput() {
  if (form.meta.value.dirty && !window.confirm(t("leave"))) return;
  const item = detail.data.value;
  form.resetForm({
    values: { title: selectedId.value && item?.id === selectedId.value ? item.title : "" },
  });
  basisRevision.value = item?.id === selectedId.value ? item.revision : null;
  message.value = "";
}
/**
 * 입력 검증 → 생성/수정 mutation → 응답 item/stats 캐시 반영 → 관련 Query 무효화 → 저장 ID URL 이동 순서다. 실패 시 초안을 유지하고 ApiError.fields를 필드에 연결한다.
 */
async function saveNote() {
  if (save.isPending.value || (selectedId.value !== null && basisRevision.value === null)) return;
  message.value = "";
  failed.value = false;
  form.setFieldError("title", undefined);
  const parsed = z
    .object({ title: z.string().trim().min(1, t("required")).max(200, t("tooLong")) })
    .safeParse(form.values);
  if (!parsed.success) {
    form.setFieldError("title", parsed.error.issues[0]?.message);
    return;
  }
  const id = selectedId.value;
  try {
    const result = await save.mutateAsync({
      id,
      title: parsed.data.title,
      revision: basisRevision.value,
    });
    form.resetForm({ values: { title: result.item.title } });
    basisRevision.value = result.item.revision;
    runtime.queryClient.setQueryData(noteKeys.detail(result.item.id), result.item);
    runtime.queryClient.setQueryData(noteKeys.stats, result.stats);
    await runtime.queryClient.invalidateQueries({ queryKey: noteKeys.all });
    await runtime.router.replace({
      name: "notes",
      params: { id: result.item.id },
      query: route.query,
    });
    message.value = t("saved");
  } catch (error) {
    failed.value = true;
    message.value = error instanceof ApiError ? error.message : t("failed");
    if (error instanceof ApiError && error.fields.title)
      form.setFieldError("title", error.fields.title);
  }
}
</script>
