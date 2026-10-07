<template>
  <sc-section-card v-if="initial?.screenVersion" :title="t('image')">
    <p>{{ t("version") }}: {{ initial.screenVersion.version }}</p>
    <p v-if="readonly">{{ t("readonly") }}</p>
    <sc-image-annotator
      v-model="box"
      :image="file.image.value"
      :image-description="`${t('image')} · ${t('version')} ${initial.screenVersion.version}`"
      :annotations="annotations"
      :selected-annotation-id="selected"
      :readonly="readonly"
      :disabled="busy || mismatch"
      :loading="file.loading.value"
      :error="mismatch ? t('mismatch') : file.error.value || annotationQuery.error.value?.message"
      :labels="labels"
      @retry="file.retry"
      @select-annotation="selected = $event"
    />
    <div v-if="!readonly" class="sc-inline">
      <sc-action-button
        :busy="busy"
        :disabled="!box || mismatch || file.loading.value"
        @click="saveBox"
      >
        {{ t("saveBox") }}
      </sc-action-button>
      <sc-action-button
        :disabled="busy || !initial.annotation"
        color="error"
        @click="deleteOpen = true"
      >
        {{ t("deleteBox") }}
      </sc-action-button>
    </div>
    <sc-confirm-dialog
      v-model="deleteOpen"
      :title="t('deleteBox')"
      :message="t('deleteBoxConfirm')"
      :busy="busy"
      :confirm-label="t('confirm')"
      :cancel-label="t('cancel')"
      @confirm="deleteBox"
    />
  </sc-section-card>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { ScSectionCard, ScActionButton, ScConfirmDialog } from "@sc/ui";
import {
  ScImageAnnotator,
  isNormalizedBox,
  type ScNormalizedBox,
  type ScImageLabels,
} from "@sc/ui/image";
import { useReferenceRuntime } from "../../auth/identity";
import type { RequirementDetail } from "../requirements/api";
import { createMediaApi, mediaKeys } from "./api";
import { useImageFile } from "./useImageFile";
import { mediaMessages } from "./messages";
const props = defineProps<{
  initial: RequirementDetail | null;
  resetKey: number;
  busy: boolean;
  readonly: boolean;
}>();
const emit = defineEmits<{
  save: [input: { box: ScNormalizedBox; revision: number }];
  delete: [input: { revision: number }];
  "dirty-change": [dirty: boolean];
}>();
const { t, locale } = useI18n({ useScope: "local", messages: mediaMessages });
const runtime = useReferenceRuntime();
const api = createMediaApi(runtime);
const fileId = computed(() => props.initial?.screenVersion?.fileId ?? null);
const versionId = computed(() => props.initial?.screenVersion?.id ?? null);
const file = useImageFile(fileId);
const annotationQuery = useQuery({
  queryKey: computed(() => mediaKeys.annotations(versionId.value)),
  queryFn: ({ queryKey, signal }) => api.annotations(queryKey[2]!, signal),
  enabled: computed(() => !!runtime.session.identity && versionId.value !== null),
});
const box = ref<ScNormalizedBox | null>(null);
const basis = ref<ScNormalizedBox | null>(null);
const revision = ref(1);
const selected = ref<string | null>(null);
const deleteOpen = ref(false);
const labels = computed<ScImageLabels>(() =>
  locale.value === "en" ? mediaMessages.en.imageLabels : mediaMessages.ko.imageLabels,
);
const mismatch = computed(
  () =>
    !!file.image.value &&
    (file.image.value.naturalWidth !== props.initial?.screenVersion?.width ||
      file.image.value.naturalHeight !== props.initial?.screenVersion?.height),
);
const annotations = computed(() =>
  (annotationQuery.data.value ?? [])
    .filter((annotation) => annotation.requirementId !== props.initial?.id)
    .map((annotation) => ({
      id: String(annotation.id),
      label: `${annotation.number}: ${annotation.title}`,
      box: { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height },
    })),
);
watch(
  () => props.resetKey,
  () => {
    const annotation = props.initial?.annotation;
    const candidate = annotation
      ? { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height }
      : null;
    box.value = isNormalizedBox(candidate) ? { ...candidate } : null;
    basis.value = box.value;
    revision.value = props.initial?.revision ?? 1;
    selected.value = null;
    deleteOpen.value = false;
  },
  { immediate: true },
);
watch(
  () => [box.value, basis.value] as const,
  () => emit("dirty-change", JSON.stringify(box.value) !== JSON.stringify(basis.value)),
  { immediate: true },
);
function saveBox() {
  if (!props.readonly && !props.busy && box.value && !mismatch.value)
    emit("save", { box: box.value, revision: revision.value });
}
function deleteBox() {
  if (!props.readonly && !props.busy && props.initial?.annotation) {
    deleteOpen.value = false;
    emit("delete", { revision: revision.value });
  }
}
</script>
