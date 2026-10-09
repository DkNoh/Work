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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * Controls props를 공개 textarea에 연결하고 사용자 입력을 미리보기로 즉시 표시한다.
 */

/*
 * description ref는 타이핑 중 draft다. update:modelValue에서는 draft만 갱신하고 native change 때 commit:modelValue를 상위 Story로 보낸다.
 *  Controls의 외부 modelValue 변경은 watch로 적용해 Storybook의 비동기 args 반영과 실제 타이핑을 구분한다.
 */
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
