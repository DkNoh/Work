<template>
  <section class="sc-content sc-stack">
    <sc-page-header :title="t('title')" :subtitle="t('hint')" />
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="invalidSelection" role="alert">{{ t("invalidQuery") }}</p>
    <sc-section-card :title="t('screens')">
      <sc-select
        :model-value="screenId ? String(screenId) : ''"
        :label="t('screen')"
        :options="screenOptions"
        :disabled="busy"
        @update:model-value="selectScreen"
      />
      <sc-select
        :model-value="versionId ? String(versionId) : ''"
        :label="t('version')"
        :options="versionOptions"
        :disabled="!screenId || busy"
        @update:model-value="selectVersion"
      />
      <sc-action-button
        variant="outlined"
        :busy="screens.isFetching.value || versions.isFetching.value"
        @click="reloadMetadata"
      >
        {{ t("refresh") }}
      </sc-action-button>
      <p v-if="screens.isError.value || versions.isError.value" role="alert">
        {{ screens.error.value?.message ?? versions.error.value?.message }}
      </p>
    </sc-section-card>
    <sc-section-card v-if="canCreateScreen" :title="t('createScreen')">
      <screen-form :menus="lookups.menus.data.value ?? []" @created="screenCreated" />
    </sc-section-card>
    <sc-section-card v-if="screenId && selectedScreen" :title="t('upload')">
      <version-upload
        :key="screenId"
        :screen-id="screenId"
        :disabled="busy"
        @uploaded="versionUploaded"
      />
    </sc-section-card>
    <sc-section-card v-if="selectedVersion" :title="`${t('version')} ${selectedVersion.version}`">
      <p>
        {{ selectedVersion.width }} × {{ selectedVersion.height }}px ·
        {{ selectedVersion.createdByName }}
      </p>
      <p v-if="selectedVersion.archived === 1" role="status">{{ t("archived") }}</p>
      <sc-action-button v-if="canArchive" variant="outlined" :busy="busy" @click="archiveVersion">
        {{ t("archive") }}
      </sc-action-button>
      <sc-image-annotator
        v-model="box"
        :image="dimensionMismatch ? null : imageFile.image.value"
        :image-description="`${selectedScreen?.name ?? t('image')} · ${t('version')} ${selectedVersion.version}`"
        :annotations="annotationItems"
        :readonly="selectedVersion.archived === 1"
        :disabled="busy"
        :loading="imageFile.loading.value"
        :error="dimensionMismatch ? t('mismatch') : imageFile.error.value"
        :labels="imageLabels"
        @retry="imageFile.retry()"
        @select-annotation="openRequirement"
      />
      <p v-if="annotations.isError.value" role="alert">{{ annotations.error.value?.message }}</p>
      <sc-section-card v-if="selectedVersion.archived !== 1" :title="t('createRequest')">
        <requirement-form
          :key="`image-requirement-${versionId}`"
          :initial="null"
          :reset-key="resetKey"
          :menus="selectedMenus"
          :busy="busy || imageFile.loading.value"
          :readonly="!imageFile.image.value || dimensionMismatch"
          :server-errors="fields"
          image-mode
          @save="createRequirement"
          @dirty-change="bodyDirty = $event"
        />
      </sc-section-card>
    </sc-section-card>
    <sc-confirm-dialog
      :model-value="guard.open.value"
      :title="t('confirm')"
      :message="guard.message.value === 'archive' ? t('archiveConfirm') : t('leave')"
      :confirm-label="t('confirm')"
      :cancel-label="t('cancel')"
      @confirm="guard.finish(true)"
      @cancel="guard.finish(false)"
    />
  </section>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 선택한 화면·버전의 이미지와 주석을 표시하고, 아래 업무 폼의 저장 이벤트를 createRequirement에 연결한다.
 * 콜론(:)은 JavaScript 값을 prop으로 전달하고 @이벤트는 자식의 알림을 부모 함수에 연결한다. 서버 저장은 부모가 담당한다.
 */

/**
 * 이미지 작업실의 화면 조립자: 화면/버전 선택 → 메타데이터 조회 → 인증된 이미지 다운로드 → 영역 지정 → 요구사항 생성 순서다.
 * 선택 ID의 원본은 Router query(screenId/versionId), 서버 목록의 원본은 Vue Query, 편집 영역/dirty는 ref, 자식 폼 초안은 useForm이 소유한다.
 * computed는 원본에서 화면용 값을 계산하며 별도 복사본을 저장하지 않는다. ref는 script에서 .value로 읽고 template에서는 자동 해제된다.
 * epoch는 선택 화면이 바뀌었는지, client generation은 로그인 세션이 바뀌었는지 검사한다. 늦게 도착한 이전 작업이 현재 입력을 덮지 않게 한다.
 */

import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { ApiError } from "@sc/runtime";
import { ScPageHeader, ScSectionCard, ScSelect, ScActionButton, ScConfirmDialog } from "@sc/ui";
import { ScImageAnnotator, type ScNormalizedBox, type ScImageLabels } from "@sc/ui/image";
import { useReferenceRuntime } from "../../auth/identity";
import { useDraftGuard } from "../../shared/useDraftGuard";
import { useRequirementLookups, requirementKeys } from "../requirements/query";
import { createRequirementsApi } from "../requirements/api";
import type { RequirementDraft } from "../requirements/schema";
import RequirementForm from "../requirements/RequirementForm.vue";
import { createMediaApi, mediaKeys, type Screen, type ScreenVersion } from "./api";
import { mediaMessages } from "./messages";
import { useImageFile } from "./useImageFile";
import ScreenForm from "./ScreenForm.vue";
import VersionUpload from "./VersionUpload.vue";
const runtime = useReferenceRuntime();
const route = useRoute();
const api = createMediaApi(runtime);
const requirements = createRequirementsApi(runtime);
const { t, locale } = useI18n({ useScope: "local", messages: mediaMessages });
const lookups = useRequirementLookups();
/**
 * URL 문자열을 양의 안전한 정수로만 해석한다. TypeScript number 타입만으로 잘못된 URL 입력을 거절할 수는 없다.
 */
function id(value: unknown) {
  return typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
    ? Number(value)
    : null;
}
const screenId = computed(() => id(route.query.screenId));
const versionId = computed(() => id(route.query.versionId));
const signedIn = computed(() => !!runtime.session.identity);
const screens = useQuery({
  queryKey: mediaKeys.screens,
  queryFn: ({ signal }) => api.screens(signal),
  enabled: signedIn,
});
const versions = useQuery({
  queryKey: computed(() => mediaKeys.versions(screenId.value)),
  queryFn: ({ queryKey, signal }) => api.versions(queryKey[2]!, signal),
  enabled: computed(() => signedIn.value && screenId.value !== null),
});
const annotations = useQuery({
  queryKey: computed(() => mediaKeys.annotations(versionId.value)),
  queryFn: ({ queryKey, signal }) => api.annotations(queryKey[2]!, signal),
  enabled: computed(() => signedIn.value && versionId.value !== null),
});
const selectedScreen = computed(
  () => screens.data.value?.find((screen) => screen.id === screenId.value) ?? null,
);
const selectedVersion = computed(
  () => versions.data.value?.find((version) => version.id === versionId.value) ?? null,
);
const invalidSelection = computed(
  () =>
    (route.query.screenId !== undefined &&
      (!screenId.value || (!!screens.data.value && !selectedScreen.value))) ||
    (route.query.versionId !== undefined &&
      (!versionId.value || !screenId.value || (!!versions.data.value && !selectedVersion.value))),
);
const fileId = computed(() => selectedVersion.value?.fileId ?? null);
const imageFile = useImageFile(fileId);
const dimensionMismatch = computed(
  () =>
    !!imageFile.image.value &&
    !!selectedVersion.value &&
    (imageFile.image.value.naturalWidth !== selectedVersion.value.width ||
      imageFile.image.value.naturalHeight !== selectedVersion.value.height),
);
const screenOptions = computed(() => [
  { value: "", label: t("choose") },
  ...(screens.data.value ?? []).map((screen) => ({ value: String(screen.id), label: screen.name })),
]);
const versionOptions = computed(() => [
  { value: "", label: t("choose") },
  ...(versions.data.value ?? []).map((version) => ({
    value: String(version.id),
    label: `${version.version} · ${version.createdByName}${version.archived === 1 ? ` · ${t("archived")}` : ""}`,
  })),
]);
const selectedMenus = computed(() =>
  (lookups.menus.data.value ?? []).filter((menu) => menu.id === selectedScreen.value?.menuId),
);
const annotationItems = computed(() =>
  (annotations.data.value ?? []).map((annotation) => ({
    id: String(annotation.requirementId),
    label: `${annotation.number}. ${annotation.title}`,
    box: { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height },
  })),
);
const imageLabels = computed<ScImageLabels>(
  () => mediaMessages[locale.value === "en" ? "en" : "ko"].imageLabels,
);
const canCreateScreen = computed(() =>
  ["ADMIN", "REVIEWER"].includes(runtime.session.identity?.role ?? ""),
);
const canArchive = computed(
  () =>
    !!selectedVersion.value &&
    selectedVersion.value.archived === 0 &&
    (canCreateScreen.value || selectedVersion.value.createdBy === runtime.session.identity?.id),
);
const box = ref<ScNormalizedBox | null>(null);
const bodyDirty = ref(false);
const busy = ref(false);
const error = ref("");
const fields = ref<Record<string, string>>({});
const resetKey = ref(0);
const dirty = computed(() => bodyDirty.value || box.value !== null);
/**
 * 브라우저 이동 전에 미저장 본문 또는 영역이 있는지 확인한다. 동일 화면/버전 내 이동만 예외로 허용한다.
 */
const guard = useDraftGuard(
  dirty,
  (to, from) =>
    to.path === from.path &&
    to.query.screenId === from.query.screenId &&
    to.query.versionId === from.query.versionId,
);
let epoch = 0;
let disposed = false;
watch(
  () => [screenId.value, versionId.value] as const,
  () => {
    epoch++;
    box.value = null;
    bodyDirty.value = false;
    busy.value = false;
    error.value = "";
    fields.value = {};
    resetKey.value++;
  },
);
onBeforeUnmount(() => {
  disposed = true;
  epoch++;
});
/**
 * 비동기 작업 시작 당시 선택/세션이 현재와 같을 때만 화면 상태를 갱신한다. 이미 떠난 화면의 finally도 현재 busy를 건드리지 않는다.
 */
function owns(selection: number, generation: number) {
  return (
    !disposed &&
    epoch === selection &&
    runtime.client.getGeneration() === generation &&
    !!runtime.session.identity
  );
}
async function selectScreen(value: string | null) {
  await runtime.router.push({ path: "/screens", query: value ? { screenId: value } : {} });
}
async function selectVersion(value: string | null) {
  await runtime.router.push({
    path: "/screens",
    query: { screenId: String(screenId.value), ...(value ? { versionId: value } : {}) },
  });
}
async function screenCreated(screen: Screen) {
  await runtime.queryClient.invalidateQueries({ queryKey: mediaKeys.screens });
  await selectScreen(String(screen.id));
}
async function versionUploaded(version: ScreenVersion) {
  await runtime.queryClient.invalidateQueries({ queryKey: mediaKeys.versions(version.screenId!) });
  await runtime.router.push({
    path: "/screens",
    query: { screenId: String(version.screenId), versionId: String(version.id) },
  });
}
async function reloadMetadata() {
  await screens.refetch();
  if (screenId.value) await versions.refetch();
  if (versionId.value) await annotations.refetch();
}
async function openRequirement(value: string) {
  await runtime.router.push(`/requests/${value}`);
}
/**
 * 사용자 확인 후 선택 버전을 보관 처리하고 해당 버전 목록 캐시를 무효화한다. UI의 canArchive는 안내이며 서버가 실제 권한을 판정한다.
 */
async function archiveVersion() {
  const version = selectedVersion.value;
  if (!version || busy.value || !canArchive.value) return;
  const selection = epoch;
  const generation = runtime.client.getGeneration();
  if (!(await guard.confirm("archive")) || !owns(selection, generation)) return;
  busy.value = true;
  error.value = "";
  try {
    await api.archive(version.id!);
    await runtime.queryClient.invalidateQueries({
      queryKey: mediaKeys.versions(version.screenId!),
    });
  } catch (cause) {
    if (owns(selection, generation))
      error.value = cause instanceof Error ? cause.message : t("required");
  } finally {
    if (owns(selection, generation)) busy.value = false;
  }
}
/**
 * 편집 중 폼과 0~1 정규화 영역을 묶어 저장한다. 성공한 상세는 Query 캐시에 넣고 목록/이미지 주석을 갱신한 뒤 상세 URL로 이동한다.
 */
async function createRequirement(draft: RequirementDraft) {
  const version = selectedVersion.value;
  if (
    !version ||
    version.archived === 1 ||
    busy.value ||
    imageFile.loading.value ||
    dimensionMismatch.value
  )
    return;
  if (!box.value) {
    error.value = t("noBox");
    return;
  }
  const selection = epoch;
  const generation = runtime.client.getGeneration();
  busy.value = true;
  error.value = "";
  fields.value = {};
  try {
    const created = await requirements.create({
      ...draft,
      menuId: Number(draft.menuId),
      revision: 1,
      screenVersionId: version.id!,
      annotation: { ...box.value },
    });
    runtime.queryClient.setQueryData(requirementKeys.detail(created.id), created);
    await runtime.queryClient.invalidateQueries({ queryKey: requirementKeys.lists });
    await runtime.queryClient.invalidateQueries({ queryKey: mediaKeys.annotations(version.id!) });
    if (owns(selection, generation)) {
      box.value = null;
      bodyDirty.value = false;
      await runtime.router.push(`/requests/${created.id}`);
    }
  } catch (cause) {
    if (owns(selection, generation)) {
      error.value = cause instanceof Error ? cause.message : t("required");
      if (cause instanceof ApiError) fields.value = cause.fields;
    }
  } finally {
    if (owns(selection, generation)) busy.value = false;
  }
}
</script>
