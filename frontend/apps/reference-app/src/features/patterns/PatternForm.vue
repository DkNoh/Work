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
 * submit.prevent로 브라우저 기본 form 전송을 막고 검증 함수를 실행한다. 확인 dialog 하나로 입력 초기화와 라우트 이탈을 처리한다.
 */

/**
 * VeeValidate + Zod + 공통 입력을 연결하는 폼 예제다. PatternInput은 컴파일 시 타입이고 z.object는 실제 실행 시 입력 검증이다.
 * useForm은 값/오류/dirty의 원본이다. defineField로 얻은 ref를 v-model에 연결하고 parsed.data만 성공 결과에 사용한다.
 * 이 예제의 저장은 로컬 결과 문구만 바꾼다. 실제 업무 저장은 별도 기능의 runtime.client API와 Service가 맡아야 한다.
 * 이탈 확인은 Promise<boolean>의 resolve를 보관해 대화상자 선택과 Router 가드를 연결한다. unmount에서 대기 중 Promise를 끝낸다.
 */

import { computed, ref, onBeforeUnmount } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { useEventListener } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useFrameworkRuntime } from "@sc/runtime";
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
const runtime = useFrameworkRuntime();
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
  if (!runtime.session.identity || !form.meta.value.dirty) return true;
  if (leaveResolve.value) return false;
  resetOpen.value = true;
  return new Promise<boolean>((resolve) => {
    leaveResolve.value = resolve;
  });
});
useEventListener(window, "beforeunload", (event) => {
  if (!runtime.session.identity || !form.meta.value.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
/**
 * 대기 중인 라우트 이동이 있으면 허용 응답을 반환하고, 그렇지 않으면 현재 폼을 초기 상태로 되돌린다.
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
 * 이전 오류를 지우고 safeParse한다. 실패 issue.path로 대상 필드를 찾아 메시지를 연결하며 성공한 경우에만 결과를 표시한다.
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
