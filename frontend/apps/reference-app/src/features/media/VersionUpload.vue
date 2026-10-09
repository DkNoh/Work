<template>
  <form class="sc-stack" :aria-label="t('upload')" @submit.prevent="uploadVersion">
    <label :for="inputId">{{ t("file") }}</label>
    <input
      :id="inputId"
      ref="input"
      type="file"
      accept="image/png,image/jpeg"
      :disabled="busy || disabled"
      required
      @change="selectFile"
    />
    <p>{{ t("limit") }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <sc-form-actions
      :submit-label="t('upload')"
      :busy="busy"
      :disabled="disabled || !file"
      :show-cancel="false"
    />
  </form>
</template>
<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * native file input에서 선택한 File을 보관하고, 공통 FormActions의 저장 동작으로 실제 업로드를 수행한다.
 */

/**
 * 선택한 화면에 이미지 파일을 새 버전으로 등록한다. props.screenId는 부모가 선택한 서버 ID이고 File은 브라우저 임시 입력이다.
 * useId는 같은 폼이 여러 개 있어도 label/input 연결 ID가 겹치지 않게 한다. ref<HTMLInputElement | null>은 DOM을 아직 얻지 못한 상태도 표현한다.
 * 업로드 완료 뒤 원본 input까지 비워 같은 파일을 다시 선택할 수 있게 하고, uploaded 이벤트로 부모의 목록 갱신/URL 이동을 유도한다.
 */

import { onBeforeUnmount, ref, useId } from "vue";
import { useI18n } from "vue-i18n";
import { ScFormActions } from "@sc/ui";
import { useReferenceRuntime } from "../../auth/identity";
import { createMediaApi, type ScreenVersion } from "./api";
import { mediaMessages } from "./messages";
const props = defineProps<{ screenId: number; disabled: boolean }>();
const emit = defineEmits<{ uploaded: [version: ScreenVersion] }>();
const { t } = useI18n({ useScope: "local", messages: mediaMessages });
const api = createMediaApi(useReferenceRuntime());
const inputId = `version-file-${useId()}`;
const input = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const busy = ref(false);
const error = ref("");
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
  file.value = null;
});
function selectFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null;
  error.value = "";
}
/**
 * 파일 없음/중복/비활성 상태를 확인하고 크기 제한을 검사한다. FormData 전송은 api.uploadVersion에 위임하며 화면 종료 후에는 결과를 표시하지 않는다.
 */
async function uploadVersion() {
  if (busy.value || props.disabled || !file.value) return;
  if (file.value.size === 0 || file.value.size > 10 * 1024 * 1024) {
    error.value = t("limit");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const version = await api.uploadVersion(props.screenId, file.value);
    if (!disposed) {
      file.value = null;
      if (input.value) input.value.value = "";
      emit("uploaded", version);
    }
  } catch (cause) {
    if (!disposed) error.value = cause instanceof Error ? cause.message : t("required");
  } finally {
    if (!disposed) busy.value = false;
  }
}
</script>
