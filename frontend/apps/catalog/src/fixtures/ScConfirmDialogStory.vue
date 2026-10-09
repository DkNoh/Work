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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 열기 버튼·확인 결과·공통 dialog를 배치하고 실패 모드에서는 dialog 본문 slot에 오류를 남긴다.
 */

/*
 * opened ref는 부모가 열림 상태를 소유하는 예제다. confirm은 자동 닫힘이 아니므로 fixture가 성공/실패에 따라 setOpened를 결정한다.
 *  simulateFailure는 Story 전용 입력으로 공개 dialog props에 섞지 않는다. 취소 이유는 ScConfirmDialogCancelReason union으로 기록한다.
 */
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
// 실패를 모의하면 열린 상태와 입력을 보존한다. 성공한 경우에만 부모 모델을 false로 바꾸는 앱 책임을 보여 준다.
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
// Controls의 외부 modelValue 변경과 화면의 열기/닫기 행동을 양방향으로 확인하되 원래 prop을 직접 수정하지 않는다.
watch(
  () => props.modelValue,
  (value) => {
    opened.value = value;
  },
);
</script>
