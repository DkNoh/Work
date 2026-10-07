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

function restoreCaller() {
  if (caller?.isConnected && !caller.closest("[inert]") && !caller.matches(":disabled")) {
    caller.focus({ preventScroll: true });
  }
  caller = undefined;
}

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
