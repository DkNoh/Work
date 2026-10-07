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
