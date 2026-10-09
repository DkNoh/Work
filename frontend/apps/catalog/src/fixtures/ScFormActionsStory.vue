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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * Select/Checkbox/TextArea와 공통 행동 막대를 실제 form 안에 배치한다. 별도 확인 버튼은 FormData에 포함된 값을 출력한다.
 */

/*
 * 각 입력의 ref는 부모 폼이 소유하는 모델이다. ScFormActions는 form ID와 busy/disabled를 받아 제출 버튼을 연결할 뿐 값을 저장하지 않는다.
 *  useId는 여러 Story를 함께 볼 때 form 연결이 겹치지 않게 한다. 제출/취소 횟수는 카탈로그 테스트용 합성 결과다.
 */
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
// native name/form 계약을 확인하기 위해 ref 객체가 아닌 실제 form의 FormData를 읽는다.
function inspectForm() {
  const form = document.getElementById(formId) as HTMLFormElement;
  submitted.value = JSON.stringify(Object.fromEntries(new FormData(form)));
}
// 부모에서 처리 중/비활성을 확인하는 예다. 이 fixture는 카운터만 늘리고 실제 API는 호출하지 않는다.
function submitForm() {
  if (props.busy || props.disabled) return;
  submissions.value += 1;
  inspectForm();
}
function cancelForm() {
  cancellations.value += 1;
}
</script>
