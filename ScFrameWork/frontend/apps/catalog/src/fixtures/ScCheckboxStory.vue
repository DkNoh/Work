<template>
  <section class="sc-stack" aria-label="체크 입력 예제">
    <sc-checkbox v-bind="props" :model-value="accepted" @update:model-value="changeAccepted" />
    <p role="status" aria-label="체크 미리보기">{{ accepted ? "동의함" : "동의하지 않음" }}</p>
  </section>
</template>

<script setup lang="ts">
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
