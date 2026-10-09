<template>
  <section class="sc-stack" aria-label="체크 입력 예제">
    <sc-checkbox v-bind="props" :model-value="accepted" @update:model-value="changeAccepted" />
    <p role="status" aria-label="체크 미리보기">{{ accepted ? "동의함" : "동의하지 않음" }}</p>
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 공개 checkbox의 현재 boolean 값을 미리보기로 표시하고 update:modelValue를 wrapper에 연결한다.
 */

/*
 * accepted ref는 Story에서 부모 폼 역할을 한다. 사용자 변경을 로컬 상태와 상위 emit에 반영하며 Controls가 바꾼 modelValue는 watch로 받는다.
 *  ScCheckboxProps type을 사용하므로 문자열을 boolean 모델 대신 전달하는 실수를 타입 검사에서 찾는다.
 */
import { ref, watch } from "vue";
import { ScCheckbox, type ScCheckboxProps } from "@sc/ui";

const props = defineProps<ScCheckboxProps>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const accepted = ref(props.modelValue);
function changeAccepted(value: boolean) {
  accepted.value = value;
  emit("update:modelValue", value);
}
watch(
  () => props.modelValue,
  (value) => {
    accepted.value = value;
  },
);
</script>
