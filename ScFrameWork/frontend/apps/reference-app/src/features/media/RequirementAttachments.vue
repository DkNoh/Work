<template>
  <sc-section-card :title="t('attachments')">
    <ul class="attachment-list">
      <li v-for="attachment in initial?.attachments ?? []" :key="attachment.id">
        <span>{{ attachment.originalName }} ({{ attachment.size }})</span>
        <sc-action-button
          variant="outlined"
          :busy="downloading === attachment.fileId"
          :aria-label="`${attachment.originalName}: ${t('download')}`"
          @click="download(attachment.fileId, attachment.originalName)"
        >
          {{ t("download") }}
        </sc-action-button>
        <sc-action-button
          v-if="!readonly"
          :disabled="busy"
          color="error"
          :aria-label="`${attachment.originalName}: ${t('remove')}`"
          @click="
            pendingDelete = attachment.id;
            deleteOpen = true;
          "
        >
          {{ t("remove") }}
        </sc-action-button>
      </li>
    </ul>
    <form v-if="!readonly" class="sc-stack" @submit.prevent="attachFile">
      <label :for="fileId">{{ t("attachmentFile") }}</label>
      <input
        :id="fileId"
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        :disabled="busy"
        @change="chooseFile"
      />
      <p v-if="file">{{ file.name }}</p>
      <sc-action-button type="submit" :busy="busy" :disabled="!file">
        {{ t("attach") }}
      </sc-action-button>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
    <sc-confirm-dialog
      v-model="deleteOpen"
      :title="t('remove')"
      :message="t('removeConfirm')"
      :busy="busy"
      :confirm-label="t('confirm')"
      :cancel-label="t('cancel')"
      @confirm="removeFile"
    />
  </sc-section-card>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ScSectionCard, ScActionButton, ScConfirmDialog } from "@sc/ui";
import type { RequirementDetail } from "../requirements/api";
import { useReferenceRuntime } from "../../auth/identity";
import { createMediaApi } from "./api";
import { mediaMessages } from "./messages";
const props = defineProps<{
  initial: RequirementDetail | null;
  resetKey: number;
  busy: boolean;
  readonly: boolean;
}>();
const emit = defineEmits<{
  attach: [input: { file: File; revision: number }];
  remove: [input: { attachmentId: number; revision: number }];
  "dirty-change": [dirty: boolean];
}>();
const { t } = useI18n({ useScope: "local", messages: mediaMessages });
const api = createMediaApi(useReferenceRuntime());
const fileId = `requirement-attachment-${useId()}`;
const fileInput = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const revision = ref(1);
const error = ref("");
const downloading = ref<number | null>(null);
const pendingDelete = ref<number | null>(null);
const deleteOpen = ref(false);
const controllers = new Set<AbortController>();
const urls = new Set<string>();
const timers = new Set<ReturnType<typeof setTimeout>>();
let active = true;
watch(
  () => props.resetKey,
  () => {
    revision.value = props.initial?.revision ?? 1;
    file.value = null;
    error.value = "";
    deleteOpen.value = false;
    pendingDelete.value = null;
    if (fileInput.value) fileInput.value.value = "";
  },
  { immediate: true },
);
watch(file, (value) => emit("dirty-change", !!value), { immediate: true });
function chooseFile(event: Event) {
  if (props.busy || props.readonly) return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const selected = input.files?.[0];
  error.value = "";
  if (
    selected &&
    (!["image/png", "image/jpeg", "application/pdf"].includes(selected.type) ||
      selected.size > 10 * 1024 * 1024)
  ) {
    error.value = t("required");
    file.value = null;
    input.value = "";
    return;
  }
  file.value = selected ?? null;
}
function attachFile() {
  if (!props.busy && !props.readonly && file.value)
    emit("attach", { file: file.value, revision: revision.value });
}
function removeFile() {
  if (!props.busy && !props.readonly && pendingDelete.value !== null) {
    deleteOpen.value = false;
    emit("remove", { attachmentId: pendingDelete.value, revision: revision.value });
  }
}
async function download(id: number, name: string) {
  if (downloading.value !== null) return;
  const controller = new AbortController();
  controllers.add(controller);
  downloading.value = id;
  error.value = "";
  try {
    const blob = await api.file(id, controller.signal);
    if (!active) return;
    const url = URL.createObjectURL(blob);
    urls.add(url);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      urls.delete(url);
      timers.delete(timer);
    }, 0);
    timers.add(timer);
  } catch (cause) {
    if (active && !controller.signal.aborted)
      error.value = cause instanceof Error ? cause.message : t("required");
  } finally {
    controllers.delete(controller);
    if (active) downloading.value = null;
  }
}
onBeforeUnmount(() => {
  active = false;
  for (const controller of controllers) controller.abort();
  for (const timer of timers) clearTimeout(timer);
  for (const url of urls) URL.revokeObjectURL(url);
});
</script>
<style scoped>
.attachment-list {
  padding: 0;
  list-style: none;
}
.attachment-list li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sc-space-2);
  margin-bottom: var(--sc-space-3);
}
.attachment-list span {
  overflow-wrap: anywhere;
}
</style>
