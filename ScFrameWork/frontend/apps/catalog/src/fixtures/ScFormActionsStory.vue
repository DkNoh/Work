<template>
  <section class="sc-stack" aria-label="공통 입력 폼 예제">
    <form :id="formId" class="sc-stack" @submit.prevent="submitForm">
      <sc-select
        v-model="category"
        :options="options"
        label="제출 구분"
        name="category"
        :disabled="props.disabled || props.busy"
      />
      <sc-checkbox
        v-model="accepted"
        label="제출 동의"
        name="accepted"
        :disabled="props.disabled || props.busy"
      />
      <sc-text-area
        v-model="description"
        label="제출 설명"
        name="description"
        :disabled="props.disabled || props.busy"
      />
      <sc-form-actions v-bind="props" :form="props.form ?? formId" @cancel="cancelForm">
        <template #notice>입력 상태와 실제 제출은 부모 form이 소유합니다.</template>
      </sc-form-actions>
    </form>
    <sc-action-button variant="text" @click="inspectForm">폼 값 확인</sc-action-button>
    <p role="status" aria-label="공통 폼 행동 결과">
      제출 {{ submissions }}회 · 취소 {{ cancellations }}회
    </p>
    <p role="status" aria-label="공통 폼 제출 값">{{ submitted }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, useId } from "vue";
import {
  ScActionButton,
  ScCheckbox,
  ScFormActions,
  ScSelect,
  ScTextArea,
  type ScFormActionsProps,
} from "@sc/ui";

const props = withDefaults(defineProps<ScFormActionsProps>(), { showCancel: true });
const formId = `sc-actions-story-${useId()}`;
const category = ref<string | null>("general");
const accepted = ref(true);
const description = ref("처음 설명");
const options = [
  { value: "general", label: "일반 제출" },
  { value: "review", label: "검토 제출" },
];
const submissions = ref(0);
const cancellations = ref(0);
const submitted = ref("제출 전");
function inspectForm() {
  const form = document.getElementById(formId) as HTMLFormElement;
  submitted.value = JSON.stringify(Object.fromEntries(new FormData(form)));
}
function submitForm() {
  if (props.busy || props.disabled) return;
  submissions.value += 1;
  inspectForm();
}
function cancelForm() {
  cancellations.value += 1;
}
</script>
