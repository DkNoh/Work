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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 비밀번호 세 필드는 useForm 입력과 연결된다. 확인 값은 브라우저 검증용이며 실제 API에는 현재/새 비밀번호만 보낸다.
 */

// 내 계정의 비밀번호 변경 흐름이다. 폼 입력/필드 오류는 VeeValidate, 요청과 세션 정리는 공통 runtime이 담당한다.
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useForm } from "vee-validate";
import { z } from "zod";
import { ApiError } from "@sc/runtime";
import { ScPageHeader, ScSectionCard, ScTextField, ScFormActions } from "@sc/ui";
import { useReferenceRuntime } from "../../auth/identity";
import { formIssueMessages } from "../../shared/validation";
// useI18n local 메시지는 이 화면의 문구 사전이다. t는 현재 언어로 표시할 문자열을 반환한다.
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
// initialValues로 값 타입이 추론된다. defineField의 첫 ref가 v-model과 연결되고 errors는 입력별 검증 결과를 표시한다.
const form = useForm({ initialValues: { currentPassword: "", newPassword: "", confirmation: "" } });
const [currentPassword] = form.defineField("currentPassword");
const [newPassword] = form.defineField("newPassword");
const [confirmation] = form.defineField("confirmation");
const busy = ref(false);
const error = ref("");
// 제출 시 Zod safeParse로 현재 값·새 비밀번호 길이/바이트 수·확인 일치를 검사한다.
// 문자 수와 UTF-8 바이트 수는 다르므로 TextEncoder로 실제 72바이트 제한을 확인한다. 타입 선언만으로는 이 검증이 되지 않는다.
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
    // 객체 전체의 교차 필드 검증이다. 오류 path를 confirmation으로 지정해 확인 입력 아래에 표시한다.
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
    // request<void>는 성공 응답 본문을 사용하지 않는다는 TS 계약이다. DB 변경과 기존 세션 종료는 서버가 처리한다.
    await runtime.client.request<void>("/auth/password", "POST", {
      currentPassword: result.data.currentPassword,
      newPassword: result.data.newPassword,
    });
    // 성공한 경우에만 비밀번호 입력을 지우고 브라우저 인증/Query 상태를 정리한 뒤 로그인 화면으로 이동한다.
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
