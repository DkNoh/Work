<template>
  <section class="sc-stack" aria-label="텍스트 입력 예제">
    <sc-text-field
      v-bind="props"
      :model-value="title"
      @update:model-value="changeTitle"
      @change="commitTitle"
    />
    <p role="status" aria-label="입력 미리보기">{{ title || "입력 없음" }}</p>
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 공개 입력의 model 변경과 native change를 나누어 받아 입력 미리보기를 표시한다.
 */

/*
 * title ref가 부모 폼의 초안 역할을 한다. 사용자 입력은 즉시 로컬 반영하고 update:modelValue 이벤트도 전달한다.
 *  commit:modelValue는 입력 확정 시 Storybook Controls에 전달하는 fixture 이벤트로 공통 입력의 새 public prop이 아니다.
 *  watch는 Controls에서 변경한 외부 값만 반영하며 타이핑과 manager의 비동기 echo를 섞지 않는 예제다.
 */
import { ref, watch } from "vue";
import { ScTextField, type ScTextFieldProps } from "@sc/ui";

const props = defineProps<ScTextFieldProps>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  "commit:modelValue": [value: string];
}>();
const title = ref(props.modelValue);
function changeTitle(value: string) {
  title.value = value;
  emit("update:modelValue", value);
}
function commitTitle() {
  // manager의 비동기 args echo가 입력 중인 ref를 과거 값으로 되돌리지 않게 한다.
  emit("commit:modelValue", title.value);
}
// Controls에서 바꾼 외부 예제 값만 초기화한다. 업무 폼 재조회와는 별개다.
watch(
  () => props.modelValue,
  (value) => {
    title.value = value;
  },
);
</script>
