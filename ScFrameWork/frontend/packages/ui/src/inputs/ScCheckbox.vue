<template>
  <v-checkbox
    v-bind="fieldAttrs()"
    :id="fieldId"
    class="sc-checkbox"
    :model-value="modelValue"
    :true-value="true"
    :false-value="false"
    :label="label"
    :error-messages="fieldErrors"
    :max-errors="fieldErrors.length"
    :hint="hint"
    :required="required"
    :disabled="disabled"
    :readonly="readonly"
    :name="name"
    :form="form"
    :autofocus="autofocus"
    :aria-invalid="fieldErrors.length > 0 || undefined"
    :aria-required="required || undefined"
    :aria-disabled="disabled || undefined"
    :aria-readonly="readonly || undefined"
    @focus="focusField"
    @blur="blurField"
    @keydown="emit('keydown', $event)"
    @keyup="emit('keyup', $event)"
    @input="inputField"
    @change="changeField"
    @update:model-value="changeValue"
  >
    <template #label>
      <span :id="`${fieldId}-label`">{{ label }}</span>
    </template>
  </v-checkbox>
</template>

<script setup lang="ts">
import { computed, ref, useAttrs, useId } from "vue";
import { VCheckbox } from "vuetify/components";
import { inputErrors, inputHtmlAttrs } from "./input-accessibility";
import type { ScCheckboxProps, ScCheckboxEmits, ScCheckboxSlots } from "./input-contracts";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScCheckboxProps>(), {
  errorMessages: "",
  hint: "",
  required: false,
  disabled: false,
  readonly: false,
  autofocus: false,
});
const emit = defineEmits<ScCheckboxEmits>();
defineSlots<ScCheckboxSlots>();
const attrs = useAttrs();
const instanceId = useId();
const focused = ref(false);
const fieldId = computed(() => props.id?.trim() || `sc-checkbox-${instanceId}`);
const fieldErrors = computed(() => inputErrors(props.errorMessages));

function fieldAttrs() {
  return inputHtmlAttrs(attrs, {
    id: fieldId.value,
    hasMessages: fieldErrors.value.length > 0 || (!!props.hint && focused.value),
    reserved: ["aria-checked"],
  });
}
function changeValue(value: unknown) {
  if (props.disabled || props.readonly || typeof value !== "boolean") return;
  emit("update:modelValue", value);
}
function focusField(event: FocusEvent) {
  focused.value = true;
  emit("focus", event);
}
function blurField(event: FocusEvent) {
  focused.value = false;
  emit("blur", event);
}
function inputField(event: Event) {
  if (!props.disabled && !props.readonly) emit("input", event);
}
function changeField(event: Event) {
  if (!props.disabled && !props.readonly) emit("change", event);
}
</script>

<style scoped lang="scss">
.sc-checkbox {
  :deep(.v-label) {
    white-space: normal;
    overflow-wrap: anywhere;
  }
}

.sc-checkbox:not(.v-input--error)
  :deep(.v-selection-control:not(.v-selection-control--dirty) .v-icon) {
  color: var(--sc-color-control-border);
  opacity: 1;
}
</style>
