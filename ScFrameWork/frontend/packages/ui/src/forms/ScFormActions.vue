<template>
  <div v-bind="actionAttrs()" class="sc-form-actions" :aria-busy="busy || undefined">
    <div v-if="$slots.notice" class="sc-form-actions__notice"><slot name="notice" /></div>
    <div class="sc-form-actions__buttons">
      <slot name="secondary" />
      <sc-action-button
        v-if="showCancel"
        type="button"
        variant="outlined"
        :disabled="disabled || busy"
        @click="cancelForm"
      >
        {{ cancelLabel }}
      </sc-action-button>
      <sc-action-button
        type="submit"
        :form="form"
        :disabled="disabled"
        :busy="busy"
        :busy-label="busyLabel"
      >
        {{ submitLabel }}
      </sc-action-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAttrs } from "vue";
import ScActionButton from "../ScActionButton.vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScFormActionsProps, ScFormActionsEmits, ScFormActionsSlots } from "./form-contracts";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScFormActionsProps>(), {
  busy: false,
  disabled: false,
  submitLabel: "저장",
  cancelLabel: "취소",
  busyLabel: "저장 중…",
  showCancel: true,
});
const emit = defineEmits<ScFormActionsEmits>();
defineSlots<ScFormActionsSlots>();
const attrs = useAttrs();

function actionAttrs() {
  return pickScHtmlAttrs(attrs, {
    attributes: ["id"],
    omit: ["aria-busy"],
  });
}
function cancelForm(event: MouseEvent) {
  if (!props.disabled && !props.busy) emit("cancel", event);
}
</script>

<style scoped lang="scss">
.sc-form-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--sc-space-4);
  padding-block: var(--sc-space-4);
  border-top: 1px solid var(--sc-color-border);
}

.sc-form-actions__notice {
  min-width: 0;
  color: var(--sc-color-text-muted);
  overflow-wrap: anywhere;
}

.sc-form-actions__buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: var(--sc-space-2);
  margin-left: auto;
}
</style>
