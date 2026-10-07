<template>
  <form novalidate class="sc-stack" :aria-label="t('document.form')" @submit.prevent="saveDraft">
    <sc-text-field
      v-model="title"
      name="title"
      :label="t('document.title')"
      :error-messages="form.errors.value.title"
      :readonly="readonly"
      :disabled="busy"
      :max-length="200"
      required
    />
    <sc-rich-text-editor
      v-model="document"
      :label="t('document.body')"
      :error-messages="
        form.errors.value.document || (invalidStored ? t('document.grammar') : undefined)
      "
      :toolbar-labels="toolbarLabels"
      :readonly="readonly || invalidStored"
      :disabled="busy"
      @invalid-document="form.setFieldError('document', $event.message)"
    />
    <sc-form-actions
      v-if="!readonly && !invalidStored"
      :busy="busy"
      :submit-label="t('document.save')"
      :show-cancel="false"
    />
  </form>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { documentScopedMessages } from "./messages";
import { ScTextField, ScFormActions } from "@sc/ui";
import { ScRichTextEditor, validateScRichTextDocument } from "@sc/ui/editor";
import type { DocumentResponse } from "./api";
import { documentSchema, emptyDocument, type DocumentDraft } from "./schema";
import { formIssueMessages } from "../../shared/validation";
const props = defineProps<{
  initial: DocumentResponse | null;
  resetKey: number;
  busy: boolean;
  readonly?: boolean;
  serverErrors: Record<string, string>;
}>();
const emit = defineEmits<{ save: [draft: DocumentDraft]; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "local", messages: documentScopedMessages });
const form = useForm<DocumentDraft>({ initialValues: { title: "", document: emptyDocument() } });
// 서버 필드 오류의 소유자는 명시적 Zod/API 검증이다. 모델 입력만으로 오류를 지우지 않는다.
const [title] = form.defineField("title", { validateOnModelUpdate: false });
const [document] = form.defineField("document", { validateOnModelUpdate: false });
const invalidStored = ref(false);
const toolbarLabels = computed(() => ({
  bold: t("document.bold"),
  italic: t("document.italic"),
  bulletList: t("document.bulletList"),
  undo: t("document.undo"),
  redo: t("document.redo"),
}));
watch(
  () => props.resetKey,
  () => {
    let value = emptyDocument();
    invalidStored.value = false;
    if (props.initial) {
      try {
        const checked = validateScRichTextDocument(JSON.parse(props.initial.documentJson));
        if (checked.valid) value = checked.document;
        else invalidStored.value = true;
      } catch {
        invalidStored.value = true;
      }
    }
    form.resetForm({ values: { title: props.initial?.title ?? "", document: value } });
  },
  { immediate: true },
);
watch(
  () => props.serverErrors,
  (errors) => {
    form.setErrors({ title: errors.title, document: errors.documentJson });
  },
);
watch(
  () => form.meta.value.dirty,
  (value) => emit("dirty-change", value),
  { immediate: true },
);
function saveDraft() {
  if (props.busy || props.readonly || invalidStored.value) return;
  form.setErrors({ title: undefined, document: undefined });
  const result = documentSchema(
    t("document.required"),
    t("document.maxTitle"),
    t("document.grammar"),
  ).safeParse(form.values);
  if (!result.success) {
    form.setErrors(formIssueMessages(result.error.issues));
    return;
  }
  emit("save", result.data);
}
</script>
