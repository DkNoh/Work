<template>
  <section class="sc-content sc-stack">
    <sc-page-header :title="t('title')" />
    <sc-section-card :title="t('change')">
      <form class="sc-stack" novalidate :aria-label="t('change')" @submit.prevent="changePassword">
        <sc-text-field
          v-model="currentPassword"
          type="password"
          :label="t('current')"
          :error-messages="form.errors.value.currentPassword"
          :disabled="busy"
          required
          autocomplete="current-password"
        />
        <sc-text-field
          v-model="newPassword"
          type="password"
          :label="t('new')"
          :error-messages="form.errors.value.newPassword"
          :disabled="busy"
          required
          autocomplete="new-password"
        />
        <sc-text-field
          v-model="confirmation"
          type="password"
          :label="t('confirmation')"
          :error-messages="form.errors.value.confirmation"
          :disabled="busy"
          required
          autocomplete="new-password"
        />
        <p>{{ t("hint") }}</p>
        <p v-if="error" role="alert">{{ error }}</p>
        <sc-form-actions :submit-label="t('change')" :busy="busy" :show-cancel="false" />
      </form>
    </sc-section-card>
  </section>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useForm } from "vee-validate";
import { z } from "zod";
import { ApiError } from "@sc/runtime";
import { ScPageHeader, ScSectionCard, ScTextField, ScFormActions } from "@sc/ui";
import { useReferenceRuntime } from "../../auth/identity";
import { formIssueMessages } from "../../shared/validation";
const { t } = useI18n({
  useScope: "local",
  messages: {
    ko: {
      title: "내 계정",
      change: "비밀번호 변경",
      current: "현재 비밀번호",
      new: "새 비밀번호",
      confirmation: "새 비밀번호 확인",
      hint: "12자 이상, UTF-8 72바이트 이하로 입력하세요. 변경 성공 후 현재 세션이 종료됩니다.",
      mismatch: "새 비밀번호가 일치하지 않습니다.",
      required: "비밀번호를 확인해 주세요.",
    },
    en: {
      title: "My account",
      change: "Change password",
      current: "Current password",
      new: "New password",
      confirmation: "Confirm new password",
      hint: "Use at least 12 characters and at most 72 UTF-8 bytes. A successful change ends this session.",
      mismatch: "The new passwords do not match.",
      required: "Check the password.",
    },
  },
});
const runtime = useReferenceRuntime();
const form = useForm({ initialValues: { currentPassword: "", newPassword: "", confirmation: "" } });
const [currentPassword] = form.defineField("currentPassword");
const [newPassword] = form.defineField("newPassword");
const [confirmation] = form.defineField("confirmation");
const busy = ref(false);
const error = ref("");
async function changePassword() {
  if (busy.value) return;
  error.value = "";
  form.setErrors({ currentPassword: undefined, newPassword: undefined, confirmation: undefined });
  const result = z
    .object({
      currentPassword: z.string().min(1, t("required")),
      newPassword: z
        .string()
        .min(12, t("hint"))
        .refine((value) => new TextEncoder().encode(value).byteLength <= 72, t("hint")),
      confirmation: z.string(),
    })
    .refine((value) => value.newPassword === value.confirmation, {
      path: ["confirmation"],
      message: t("mismatch"),
    })
    .safeParse(form.values);
  if (!result.success) {
    form.setErrors(formIssueMessages(result.error.issues));
    return;
  }
  busy.value = true;
  try {
    await runtime.client.request<void>("/auth/password", "POST", {
      currentPassword: result.data.currentPassword,
      newPassword: result.data.newPassword,
    });
    form.resetForm();
    runtime.resetSession();
    await runtime.router.replace("/login");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t("required");
    if (cause instanceof ApiError) form.setErrors(cause.fields);
  } finally {
    busy.value = false;
  }
}
</script>
