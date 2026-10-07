<template>
  <section class="sc-stack" aria-label="선택 입력 예제">
    <sc-select v-bind="props" :model-value="selected" @update:model-value="changeSelection" />
    <p role="status" aria-label="선택 미리보기">{{ selected ?? "선택 없음" }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ScSelect, type ScSelectProps } from "@sc/ui";

const props = defineProps<ScSelectProps>();
const emit = defineEmits<{ "update:modelValue": [value: string | null] }>();
const selected = ref(props.modelValue);
function changeSelection(value: string | null) {
  selected.value = value;
  emit("update:modelValue", value);
}
watch(
  () => props.modelValue,
  (value) => {
    selected.value = value;
  },
);
</script>
