<template>
  <section class="sc-stack" aria-label="여러 줄 입력 예제">
    <sc-text-area
      v-bind="props"
      :model-value="description"
      @update:model-value="changeDescription"
      @change="commitDescription"
    />
    <p class="sc-text-area-story__preview" role="status" aria-label="설명 미리보기">
      {{ description || "입력 없음" }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ScTextArea, type ScTextAreaProps } from "@sc/ui";

const props = defineProps<ScTextAreaProps>();
const emit = defineEmits<{ "commit:modelValue": [value: string] }>();
const description = ref(props.modelValue);
function changeDescription(value: string) {
  description.value = value;
}
function commitDescription() {
  emit("commit:modelValue", description.value);
}
// 입력 draft는 즉시 표시하고 Controls에는 native change에서 확정값을 전달한다.
watch(
  () => props.modelValue,
  (value) => {
    description.value = value;
  },
);
</script>

<style scoped lang="scss">
.sc-text-area-story__preview {
  white-space: pre-line;
  overflow-wrap: anywhere;
}
</style>
