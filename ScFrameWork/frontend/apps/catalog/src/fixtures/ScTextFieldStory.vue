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
