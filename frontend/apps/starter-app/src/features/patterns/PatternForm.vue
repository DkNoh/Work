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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * submit.prevent로 전체 문서 전송을 막고 validateInput을 실행한다. reset/leave 두 확인 동작이 dialog를 공유한다.
 */

/**
 * 공통 입력 + VeeValidate + Zod를 연결하는 로컬 폼 예제다. PatternInput은 컴파일 시 모양이고 Zod는 실제 입력 값의 유효성을 검사한다.
 * defineField의 ref를 v-model로 연결하며 값/오류/dirty의 원본은 useForm이다. 검증 성공 메시지는 예제일 뿐 서버 저장을 실행하지 않는다.
 * 미저장 입력 이탈은 Router 가드와 브라우저 beforeunload로 다룬다. Promise resolve를 dialog에 연결하고 unmount에서 대기를 끝낸다.
 */

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
/**
 * 라우트 이동 대기가 있으면 허용 응답을 주고, 없으면 폼을 초기화한다. 같은 확인 UI가 두 동작을 구분하는 지점이다.
 */
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
/**
 * 필드 오류를 먼저 비우고 safeParse한다. 실패 경로를 허용 필드에만 연결하며 parsed.data를 성공 결과의 원본으로 쓴다.
 */
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
