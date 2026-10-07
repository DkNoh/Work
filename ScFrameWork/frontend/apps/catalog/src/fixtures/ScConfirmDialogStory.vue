<template>
  <section class="sc-stack" aria-label="확인 대화상자 예제">
    <sc-action-button @click="setOpened(true)">확인 대화상자 열기</sc-action-button>
    <p role="status" aria-label="확인 결과">{{ result }} · 확인 {{ confirmations }}회</p>
    <sc-confirm-dialog
      v-bind="dialogProps()"
      :model-value="opened"
      @update:model-value="setOpened"
      @confirm="confirmAction"
      @cancel="cancelAction"
    >
      <p>취소하면 현재 입력을 유지합니다.</p>
      <p v-if="failure" role="alert">{{ failure }}</p>
    </sc-confirm-dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  ScActionButton,
  ScConfirmDialog,
  type ScConfirmDialogProps,
  type ScConfirmDialogCancelReason,
} from "@sc/ui";

interface StoryProps extends ScConfirmDialogProps {
  readonly simulateFailure?: boolean;
}
const props = defineProps<StoryProps>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const opened = ref(props.modelValue);
const confirmations = ref(0);
const result = ref("선택 전");
const failure = ref("");
function dialogProps(): ScConfirmDialogProps {
  // fixture의 실패 모드는 라이브러리 props나 attrs에 전달하지 않는다.
  return {
    modelValue: props.modelValue,
    title: props.title,
    message: props.message,
    confirmLabel: props.confirmLabel,
    cancelLabel: props.cancelLabel,
    busyLabel: props.busyLabel,
    busy: props.busy,
    intent: props.intent,
    id: props.id,
  };
}
function setOpened(value: boolean) {
  opened.value = value;
  emit("update:modelValue", value);
}
function confirmAction() {
  confirmations.value += 1;
  result.value = "확인";
  if (props.simulateFailure) {
    failure.value = "처리하지 못했습니다. 입력을 보존하고 다시 시도할 수 있습니다.";
    return;
  }
  setOpened(false);
}
function cancelAction(reason: ScConfirmDialogCancelReason) {
  result.value = `취소(${reason})`;
}
watch(
  () => props.modelValue,
  (value) => {
    opened.value = value;
  },
);
</script>
