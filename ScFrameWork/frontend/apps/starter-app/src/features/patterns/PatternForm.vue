<template>
  <sc-section-card :title="t('app.form')" :description="t('app.formHint')">
    <form novalidate class="sc-stack" :aria-label="t('app.form')" @submit.prevent="validateInput">
      <sc-text-field
        v-model="title"
        :label="t('app.title')"
        name="title"
        :error-messages="form.errors.value.title"
        required
      />
      <sc-select
        v-model="category"
        :label="t('app.category')"
        :options="options"
        :error-messages="form.errors.value.category"
        name="category"
        required
      />
      <sc-text-area
        v-model="description"
        :label="t('app.description')"
        name="description"
        :error-messages="form.errors.value.description"
        :rows="3"
      />
      <sc-checkbox
        v-model="accepted"
        :label="t('app.accepted')"
        name="accepted"
        :error-messages="form.errors.value.accepted"
        required
      />
      <p>{{ t("app.formNote") }}</p>
      <p v-if="result" role="status">{{ result }}</p>
      <sc-form-actions
        :submit-label="t('common.actions.save')"
        :cancel-label="t('common.actions.reset')"
        @cancel="confirmReset"
      />
    </form>
    <sc-confirm-dialog
      v-model="resetOpen"
      :title="t('app.confirmTitle')"
      :message="t(leaveResolve ? 'app.leave' : 'app.discard')"
      :confirm-label="t('common.actions.reset')"
      :cancel-label="t('common.actions.cancel')"
      @confirm="approveReset"
      @cancel="rejectLeave"
    />
  </sc-section-card>
</template>
<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { useEventListener } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useForm } from "vee-validate";
import { z } from "zod";
import {
  ScSectionCard,
  ScTextField,
  ScSelect,
  ScTextArea,
  ScCheckbox,
  ScFormActions,
  ScConfirmDialog,
} from "@sc/ui";
interface PatternInput {
  title: string;
  category: string | null;
  description: string;
  accepted: boolean;
}
const { t } = useI18n({ useScope: "global" });
const initialValues: PatternInput = { title: "", category: null, description: "", accepted: false };
const form = useForm<PatternInput>({ initialValues });
const [title] = form.defineField("title");
const [category] = form.defineField("category");
const [description] = form.defineField("description");
const [accepted] = form.defineField("accepted");
const options = computed(() => [
  { value: "analysis", label: t("app.analysis") },
  { value: "development", label: t("app.development") },
]);
const result = ref("");
const resetOpen = ref(false);
const leaveResolve = ref<((allowed: boolean) => void) | null>(null);
onBeforeRouteLeave(() => {
  if (!form.meta.value.dirty) return true;
  if (leaveResolve.value) return false;
  resetOpen.value = true;
  return new Promise<boolean>((resolve) => {
    leaveResolve.value = resolve;
  });
});
useEventListener(window, "beforeunload", (event) => {
  if (!form.meta.value.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
function approveReset() {
  if (leaveResolve.value) {
    const resolve = leaveResolve.value;
    leaveResolve.value = null;
    resetOpen.value = false;
    resolve(true);
  } else resetInput();
}
function rejectLeave() {
  const resolve = leaveResolve.value;
  leaveResolve.value = null;
  resetOpen.value = false;
  resolve?.(false);
}
onBeforeUnmount(() => rejectLeave());
function validateInput() {
  result.value = "";
  form.setErrors({
    title: undefined,
    category: undefined,
    description: undefined,
    accepted: undefined,
  });
  const schema = z.object({
    title: z.string().trim().min(1, t("app.required")).max(200, t("app.maxTitle")),
    category: z.enum(["analysis", "development"], { error: t("app.required") }),
    description: z.string().trim().max(2000),
    accepted: z.literal(true, { error: t("app.acceptRequired") }),
  });
  const parsed = schema.safeParse(form.values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "title" || key === "category" || key === "description" || key === "accepted")
        form.setFieldError(key, issue.message);
    }
    return;
  }
  // 성공한 파싱 값만 소비한다. schema는 공통 UI가 아닌 이 폼의 규칙이다.
  result.value = `${t("app.saved")} ${parsed.data.title}`;
}
function confirmReset() {
  if (form.meta.value.dirty) resetOpen.value = true;
  else resetInput();
}
function resetInput() {
  form.resetForm({ values: { ...initialValues } });
  result.value = "";
  resetOpen.value = false;
}
</script>
