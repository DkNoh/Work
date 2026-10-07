<template>
  <div class="sc-stack">
    <ol class="comments-list" :aria-label="t('request.comments')">
      <li v-for="comment in comments" :key="comment.id">
        <p class="comment-meta">{{ comment.authorName }} · {{ formatDate(comment.createdAt) }}</p>
        <p class="comment-body">{{ comment.body }}</p>
      </li>
    </ol>
    <p v-if="comments.length === 0">{{ t("request.noComments") }}</p>
    <form
      novalidate
      class="sc-stack"
      :aria-label="t('request.commentForm')"
      @submit.prevent="addComment"
    >
      <sc-text-area
        v-model="body"
        :label="t('request.commentBody')"
        :error-messages="form.errors.value.body"
        :disabled="busy"
        :max-length="10000"
        required
      />
      <sc-form-actions :busy="busy" :submit-label="t('request.addComment')" :show-cancel="false" />
    </form>
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";
import { useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { ScFormActions, ScTextArea } from "@sc/ui";
import type { RequirementDetail } from "./api";
import { commentSchema, schemaErrors } from "./schema";
const props = defineProps<{
  comments: RequirementDetail["comments"];
  resetKey: number;
  busy: boolean;
  serverErrors: Readonly<Record<string, string>>;
  formatDate: (value: string | null) => string;
}>();
const emit = defineEmits<{ add: [body: string]; "dirty-change": [dirty: boolean] }>();
const { t } = useI18n({ useScope: "global" });
const form = useForm<{ body: string }>({ initialValues: { body: "" } });
const [body] = form.defineField("body");
watch(
  () => props.resetKey,
  () => form.resetForm({ values: { body: "" } }),
);
watch(
  () => props.serverErrors,
  (errors) => {
    form.setFieldError("body", undefined);
    form.setErrors(errors);
  },
);
watch(
  () => form.meta.value.dirty,
  (dirty) => emit("dirty-change", dirty),
  { immediate: true },
);
function addComment() {
  if (props.busy) return;
  form.setFieldError("body", undefined);
  const result = commentSchema.safeParse(form.values);
  if (!result.success) {
    form.setErrors(schemaErrors(result.error.issues));
    return;
  }
  emit("add", result.data.body);
}
</script>

<style scoped>
.comments-list {
  margin: 0;
  padding-left: var(--sc-space-6);
}
.comment-meta {
  color: var(--sc-color-text-muted);
}
.comment-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
