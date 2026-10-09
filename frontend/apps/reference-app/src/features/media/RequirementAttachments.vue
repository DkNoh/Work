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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 목록은 서버 initial에서 읽고, 선택한 새 파일은 브라우저 초안으로 관리한다. 삭제는 확인 대화상자 뒤 remove 이벤트를 보낸다.
 */

/**
 * 첨부 파일 선택/다운로드/삭제 확인을 제공한다. 업로드와 삭제는 revision을 포함한 이벤트로 부모 요구사항 작업 공간에 위임한다.
 * File은 브라우저 객체이며 서버 경로가 아니다. 선택한 파일은 ref에 임시 보관하고 resetKey 변경 때 파일 input과 함께 비운다.
 * 다운로드에는 인증된 공통 client를 사용한다. AbortController·Object URL·timer는 이 컴포넌트가 생성하므로 unmount에서 정리한다.
 */

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
/**
 * 파일 크기/지원 MIME을 먼저 확인하는 사용자 안내다. 브라우저 메타데이터만 신뢰하지 않고 서버에서도 파일을 검증한다.
 */
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
/**
 * Blob을 받은 뒤 임시 Object URL과 a.download로 다운로드한다. 화면을 떠나면 요청을 중단하며 URL을 계속 보관하지 않는다.
 */
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
/**
 * 화면 수명이 끝날 때 미완료 요청·예약 작업·브라우저 메모리 URL을 해제한다. Java의 close/finally와 목적은 비슷하지만 Vue 수명에 묶인다.
 */
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
