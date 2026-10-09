<template>
  <dialog
    v-bind="dialogAttrs()"
    :id="dialogId"
    ref="dialog"
    class="sc-confirm-dialog"
    :aria-labelledby="titleId"
    :aria-describedby="message ? messageId : undefined"
    :aria-busy="busy || undefined"
    @cancel.prevent="cancelConfirmation('escape')"
    @keydown="handleKeydown"
    @click="closeOnBackdrop"
  >
    <h2 :id="titleId" class="sc-confirm-dialog__title">{{ title }}</h2>
    <p v-if="message" :id="messageId" class="sc-confirm-dialog__message">{{ message }}</p>
    <div v-if="$slots.default" class="sc-confirm-dialog__content"><slot /></div>
    <div class="sc-confirm-dialog__actions">
      <sc-action-button
        type="button"
        variant="outlined"
        :disabled="busy"
        @click="cancelConfirmation('button')"
      >
        {{ cancelLabel }}
      </sc-action-button>
      <sc-action-button
        type="button"
        :color="intent === 'danger' ? 'error' : 'primary'"
        :busy="busy"
        :busy-label="busyLabel"
        @click="confirmAction"
      >
        {{ confirmLabel }}
      </sc-action-button>
    </div>
  </dialog>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 브라우저 native dialog에 제목·설명·추가 slot·확인/취소 버튼을 표시한다.
 * @cancel.prevent는 브라우저 기본 닫기를 막고 부모 모델을 통한 닫기 요청으로 통일한다. busy 동안 사용자 취소/확인을 제한한다.
 */

/*
 * 열림 상태 modelValue와 저장/삭제 결과는 부모가 소유한다. 확인은 confirm만 emit하며 성공할 때 닫을지는 부모가 결정한다.
 *  ref<HTMLDialogElement>는 화면에 생성된 dialog DOM 참조다. Vue 상태와 showModal/close라는 브라우저 명령을 동기화해야 한다.
 *  caller는 열기 전 포커스 위치, actionPending은 부모 busy 반영 전의 같은 렌더 주기 중복 이벤트를 막는 내부 값이다.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId, watch } from "vue";
import ScActionButton from "../ScActionButton.vue";
import { pickScHtmlAttrs } from "../contracts";
import type {
  ScConfirmDialogProps,
  ScConfirmDialogEmits,
  ScConfirmDialogSlots,
  ScConfirmDialogCancelReason,
} from "./form-contracts";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScConfirmDialogProps>(), {
  message: "",
  confirmLabel: "확인",
  cancelLabel: "취소",
  busyLabel: "처리 중…",
  busy: false,
  intent: "default",
});
const emit = defineEmits<ScConfirmDialogEmits>();
defineSlots<ScConfirmDialogSlots>();
const attrs = useAttrs();
const instanceId = useId();
const dialogId = computed(() => props.id?.trim() || `sc-confirm-dialog-${instanceId}`);
const titleId = computed(() => `${dialogId.value}-title`);
const messageId = computed(() => `${dialogId.value}-message`);
const dialog = ref<HTMLDialogElement>();
let caller: HTMLElement | undefined;
let actionPending = false;

function dialogAttrs() {
  return pickScHtmlAttrs(attrs, {
    omit: [
      "role",
      "tabindex",
      "aria-modal",
      "aria-label",
      "aria-labelledby",
      "aria-describedby",
      "aria-busy",
    ],
  });
}

// 현재 보이는 활성 컨트롤만 수집해 Tab 순환에 사용한다. 숨김/disabled/inert 요소를 포함하면 사용자가 포커스를 잃을 수 있다.
function focusableControls(): HTMLElement[] {
  return Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex], [contenteditable="true"]',
    ) ?? [],
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.closest("[inert]") &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden",
  );
}

// 닫힘 후 원래 버튼으로 돌아간다. 화면 전환으로 사라졌거나 비활성화된 요소에는 포커스를 강제로 돌리지 않는다.
function restoreCaller() {
  if (caller?.isConnected && !caller.closest("[inert]") && !caller.matches(":disabled")) {
    caller.focus({ preventScroll: true });
  }
  caller = undefined;
}

// DOM 생성 이후 실행해야 showModal을 호출할 수 있다. 부모가 false로 바꾸는 닫기는 busy 중에도 반영한다.
function synchronizeDialog() {
  const element = dialog.value;
  if (!element?.isConnected) return;
  if (props.modelValue && !element.open) {
    caller = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    element.showModal();
    // 되돌리기 어려운 업무에도 쓰이므로 초기 포커스는 안전한 취소 행동에 둔다.
    const cancelButton = element.querySelector<HTMLButtonElement>(
      ".sc-confirm-dialog__actions button",
    );
    if (cancelButton && !cancelButton.disabled) cancelButton.focus({ preventScroll: true });
    else element.focus({ preventScroll: true });
  } else if (!props.modelValue && element.open) {
    element.close();
    restoreCaller();
  }
}

// 취소 이유는 string union으로 제한된다. cancel 알림과 update:modelValue(false)를 보내도 props 자체를 바꾸지는 않는다.
function cancelConfirmation(reason: ScConfirmDialogCancelReason) {
  if (!props.modelValue || props.busy || actionPending) return;
  actionPending = true;
  try {
    emit("cancel", reason);
    emit("update:modelValue", false);
  } finally {
    void nextTick(() => {
      actionPending = false;
    });
  }
}

// 확인은 닫기와 분리한다. 서버 실패 시 같은 대화상자에서 오류/재시도를 보여 줄 수 있도록 부모의 후속 판단을 기다린다.
function confirmAction() {
  if (!props.modelValue || props.busy || actionPending) return;
  actionPending = true;
  try {
    emit("confirm");
  } finally {
    void nextTick(() => {
      actionPending = false;
    });
  }
}

// Escape와 Tab 경계를 직접 처리해 키보드 사용자가 열린 modal 밖으로 빠져나가지 않도록 한다.
function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelConfirmation("escape");
    return;
  }
  if (event.key !== "Tab" || !dialog.value?.open) return;
  const controls = focusableControls();
  const first = controls[0];
  const last = controls.at(-1);
  if (!first) {
    event.preventDefault();
    dialog.value.focus({ preventScroll: true });
  } else if (
    event.shiftKey &&
    (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))
  ) {
    event.preventDefault();
    last?.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))
  ) {
    event.preventDefault();
    first.focus();
  }
}

// dialog 내부 빈 공간의 클릭과 진짜 바깥 배경 클릭을 좌표로 구분한다.
function closeOnBackdrop(event: MouseEvent) {
  const element = dialog.value;
  if (!element || event.target !== element) return;
  const bounds = element.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  ) {
    cancelConfirmation("backdrop");
  }
}

// watch는 값 변경에 따른 부수 효과(DOM dialog 명령)에 사용한다. flush:post는 Vue DOM 반영 뒤 실행한다.
// 초기 mount에서도 동기화하고 unmount 때 열린 dialog와 포커스를 정리해 화면 전환에 흔적을 남기지 않는다.
watch(() => props.modelValue, synchronizeDialog, { flush: "post" });
onMounted(synchronizeDialog);
onBeforeUnmount(() => {
  if (dialog.value?.open) {
    dialog.value.close();
    restoreCaller();
  }
});
</script>

<style scoped lang="scss">
.sc-confirm-dialog {
  box-sizing: border-box;
  width: min(calc(100vw - var(--sc-space-8)), 32rem);
  max-height: calc(100dvh - var(--sc-space-8));
  margin: auto;
  padding: var(--sc-space-6);
  overflow: auto;
  border: 1px solid var(--sc-color-border);
  border-radius: var(--sc-radius-lg);
  color: var(--sc-color-text);
  background: var(--sc-color-surface);
  box-shadow: var(--sc-shadow-overlay);
  font: inherit;
}

.sc-confirm-dialog::backdrop {
  background: rgb(24 60 75 / 40%);
}

.sc-confirm-dialog__title {
  margin: 0 0 var(--sc-space-4);
  font-size: var(--sc-font-size-section);
  line-height: var(--sc-line-height-title);
  overflow-wrap: anywhere;
}

.sc-confirm-dialog__message,
.sc-confirm-dialog__content {
  margin: 0 0 var(--sc-space-6);
  line-height: var(--sc-line-height-body);
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.sc-confirm-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sc-space-2);
}

.sc-confirm-dialog:focus-visible {
  outline: 2px solid var(--sc-color-focus);
  outline-offset: -4px;
}
</style>
