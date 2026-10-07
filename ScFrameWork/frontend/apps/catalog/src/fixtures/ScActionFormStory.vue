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
function submitForm(event: SubmitEvent) {
  submitCount.value += 1;
  const form = event.currentTarget as HTMLFormElement;
  submittedTitle.value = String(new FormData(form).get("formTitle") ?? "");
}
function resetForm() {
  resetCount.value += 1;
  // 네이티브 reset 이벤트와 폼의 model 원본을 함께 초기화한다.
  title.value = initialTitle;
}
</script>
