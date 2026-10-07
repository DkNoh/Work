<template>
  <form novalidate class="sc-stack" aria-label="모의 저장 폼" @submit.prevent="saveInput">
    <sc-text-field
      v-model="title"
      label="제목"
      :error-messages="form.errors.value.title"
      :disabled="saving"
      required
    />
    <p v-if="failure" role="alert" aria-label="저장 오류">{{ failure }}</p>
    <p v-if="saved" role="status" aria-label="저장 결과">저장한 제목: {{ saved }}</p>
    <p role="status" aria-label="제출 횟수">{{ attempts }}</p>
    <sc-form-actions :busy="saving" @cancel="form.resetForm({ values: { title: '' } })" />
  </form>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { createMemoryHistory } from "vue-router";
import { useForm } from "vee-validate";
import { z } from "zod";
import { ApiError, createFrameworkRuntime } from "@sc/runtime";
import { ScTextField, ScFormActions } from "@sc/ui";
const runtime = createFrameworkRuntime({ history: createMemoryHistory(), routes: [] });
const form = useForm<{ title: string }>({ initialValues: { title: "" } });
const [title] = form.defineField("title");
const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해 주세요.")
    .max(200, "제목은 200자 이하여야 합니다."),
});
const saving = ref(false);
const failure = ref("");
const saved = ref("");
const attempts = ref(0);
let disposed = false;
async function saveInput() {
  if (saving.value) return;
  form.setErrors({ title: undefined });
  failure.value = "";
  saved.value = "";
  const parsed = schema.safeParse(form.values);
  if (!parsed.success) {
    form.setFieldError("title", parsed.error.issues[0]?.message);
    return;
  }
  saving.value = true;
  attempts.value++;
  try {
    const result = await runtime.client.request<{ title: string }>(
      "/story-form",
      "POST",
      parsed.data,
    );
    if (disposed) return;
    saved.value = result.title;
    form.resetForm({ values: { title: "" } });
  } catch (error) {
    if (disposed) return;
    if (error instanceof ApiError && error.fields.title)
      form.setFieldError("title", error.fields.title);
    failure.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (!disposed) saving.value = false;
  }
}
onBeforeUnmount(() => {
  disposed = true;
  runtime.dispose();
});
</script>
