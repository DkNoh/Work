<template>
  <form
    class="sc-stack"
    aria-label="공통 버튼 폼 계약"
    @submit.prevent="submitForm"
    @reset="resetForm"
  >
    <sc-text-field v-model="title" label="폼 제목" name="formTitle" required />
    <div class="sc-row">
      <sc-action-button v-bind="props" @click="executeAction">동작 실행</sc-action-button>
      <sc-action-button type="submit">폼 제출</sc-action-button>
      <sc-action-button type="reset" variant="outlined">폼 초기화</sc-action-button>
    </div>
    <p role="status" aria-label="폼 동작 결과">
      동작 {{ actionCount }}회 · 제출 {{ submitCount }}회 · 초기화 {{ resetCount }}회
    </p>
    <p role="status" aria-label="제출한 제목">{{ submittedTitle || "제출 없음" }}</p>
  </form>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 동작·submit·reset 버튼을 실제 HTML form에 배치해 버튼 type의 차이를 보여 준다. 제출 횟수와 FormData 값을 따로 출력한다.
 */

/*
 * Controls props를 받는 버튼이 native form 동작에 미치는 영향을 확인한다. title ref는 Vue 입력 원본이고 submittedTitle은 마지막 제출 결과다.
 *  submit.prevent는 페이지 이동을 막을 뿐 검증/저장을 자동 구현하지 않는다. 이 fixture는 합성 입력을 브라우저 안에서만 처리한다.
 */
import { ref } from "vue";
import { ScActionButton, ScTextField, type ScActionButtonProps } from "@sc/ui";

const props = defineProps<ScActionButtonProps>();
const initialTitle = "처음 제목";
const title = ref(initialTitle);
const submittedTitle = ref("");
const actionCount = ref(0);
const submitCount = ref(0);
const resetCount = ref(0);
function executeAction() {
  actionCount.value += 1;
}
// currentTarget은 이벤트를 받은 form이다. FormData로 name 있는 입력값을 읽어 실제 native 제출 계약을 확인한다.
function submitForm(event: SubmitEvent) {
  submitCount.value += 1;
  const form = event.currentTarget as HTMLFormElement;
  submittedTitle.value = String(new FormData(form).get("formTitle") ?? "");
}
// 브라우저 reset만으로 Vue ref가 자동 초기화되지는 않는다. 부모 역할의 fixture가 모델을 함께 되돌린다.
function resetForm() {
  resetCount.value += 1;
  // 네이티브 reset 이벤트와 폼의 model 원본을 함께 초기화한다.
  title.value = initialTitle;
}
</script>
