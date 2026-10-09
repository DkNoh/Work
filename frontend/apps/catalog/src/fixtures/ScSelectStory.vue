<template>
  <section class="sc-stack" aria-label="선택 입력 예제">
    <sc-select v-bind="props" :model-value="selected" @update:model-value="changeSelection" />
    <p role="status" aria-label="선택 미리보기">{{ selected ?? "선택 없음" }}</p>
  </section>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 현재 선택값 또는 선택 없음(null)을 미리보기에 표시하고 공개 select의 변경 요청을 연결한다.
 */

/*
 * selected ref가 부모 입력 역할을 한다. 사용자 변경은 로컬 상태+상위 emit으로, Controls 외부 변경은 watch로 연결한다.
 *  string|null union은 빈 선택을 빈 문자열이나 boolean과 구분하며 공개 @sc/ui 타입을 그대로 사용한다.
 */
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
