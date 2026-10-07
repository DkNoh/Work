<template>
  <form novalidate class="sc-stack" :aria-label="t('notice.form')" @submit.prevent="saveDraft">
    <sc-text-field
      v-model="title"
      name="title"
      :label="t('notice.title')"
      :error-messages="form.errors.value.title"
      :readonly="readonly"
      :disabled="busy"
      :max-length="200"
      required
    />
    <sc-text-area
      v-model="content"
      name="content"
      :label="t('notice.body')"
      :error-messages="form.errors.value.content"
      :readonly="readonly"
      :disabled="busy"
      :max-length="50000"
      :rows="8"
      required
    />
    <sc-form-actions
      v-if="!readonly"
      :busy="busy"
      :submit-label="t('notice.save')"
      :show-cancel="false"
    />
  </form>
</template>
<script setup lang="ts">
import { watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { noticeScopedMessages } from "./messages";
import { ScTextField, ScFormActions, ScTextArea } from "@sc/ui";

import type { NoticeResponse } from "./api";
import { noticeSchema, type NoticeDraft } from "./schema";
import { formIssueMessages } from "../../shared/validation";
const props = defineProps<{
  initial: NoticeResponse | null;
  resetKey: number;
  busy: boolean;
  readonly?: boolean;
  serverErrors: Record<string, string>;
}>();
const emit = defineEmits<{ save: [draft: NoticeDraft]; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "local", messages: noticeScopedMessages });
const form = useForm<NoticeDraft>({ initialValues: { title: "", content: "" } });
// 서버 필드 오류의 소유자는 명시적 Zod/API 검증이다. 모델 입력만으로 오류를 지우지 않는다.
const [title] = form.defineField("title", { validateOnModelUpdate: false });
const [content] = form.defineField("content", { validateOnModelUpdate: false });

watch(
  () => props.resetKey,
  () => {
    form.resetForm({
      values: { title: props.initial?.title ?? "", content: props.initial?.content ?? "" },
    });
  },
  { immediate: true },
);
watch(
  () => props.serverErrors,
  (errors) => {
    form.setErrors({ title: errors.title, content: errors.content });
  },
);
watch(
  () => form.meta.value.dirty,
  (value) => emit("dirty-change", value),
  { immediate: true },
);
function saveDraft() {
  if (props.busy || props.readonly) return;
  form.setErrors({ title: undefined, content: undefined });
  const result = noticeSchema(
    t("notice.required"),
    t("notice.maxTitle"),
    t("notice.maxBody"),
  ).safeParse(form.values);
  if (!result.success) {
    form.setErrors(formIssueMessages(result.error.issues));
    return;
  }
  emit("save", result.data);
}
</script>
