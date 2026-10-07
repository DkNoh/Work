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
