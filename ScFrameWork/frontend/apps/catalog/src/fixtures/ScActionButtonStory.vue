<template>
  <section class="sc-stack" aria-label="동작 버튼 예제">
    <div>
      <sc-action-button v-bind="buttonProps" :aria-label="buttonLabel" @click="executeAction">
        <template v-if="!props.iconOnly">저장</template>
      </sc-action-button>
    </div>
    <p role="status" aria-label="버튼 실행 횟수">실행 {{ count }}회</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ScActionButton, type ScActionButtonProps } from "@sc/ui";

const props = defineProps<ScActionButtonProps & { buttonLabel?: string }>();
const buttonProps = computed(() => {
  const button = { ...props };
  delete button.buttonLabel;
  return button;
});
const count = ref(0);
function executeAction() {
  count.value += 1;
}
</script>
