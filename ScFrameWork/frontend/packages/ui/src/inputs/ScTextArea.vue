<template>
  <v-textarea
    v-bind="fieldAttrs()"
    :id="fieldId"
    class="sc-text-area"
    :data-density="density"
    :density="density"
    variant="outlined"
    color="primary"
    :model-value="modelValue"
    :label="label"
    :error-messages="fieldErrors"
    :max-errors="fieldErrors.length"
    :hint="hint"
    :required="required"
    :disabled="disabled"
    :readonly="readonly"
    :name="name"
    :autocomplete="autocomplete"
    :form="form"
    :placeholder="placeholder"
    :maxlength="maxLength"
    :minlength="minLength"
    :inputmode="inputMode"
    :autofocus="autofocus"
    :rows="rows"
    :auto-grow="autoGrow"
    :max-rows="maxRows"
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
  />
</template>

<script setup lang="ts">
import { computed, ref, useAttrs, useId } from "vue";
import { VTextarea } from "vuetify/components";
import { inputErrors, inputHtmlAttrs } from "./input-accessibility";
import type { ScTextAreaProps, ScTextAreaEmits, ScTextAreaSlots } from "./input-contracts";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScTextAreaProps>(), {
  errorMessages: "",
  hint: "",
  required: false,
  disabled: false,
  readonly: false,
  autofocus: false,
  rows: 4,
  autoGrow: false,
  density: "comfortable",
});
const emit = defineEmits<ScTextAreaEmits>();
defineSlots<ScTextAreaSlots>();
const attrs = useAttrs();
const instanceId = useId();
const focused = ref(false);
const fieldId = computed(() => props.id?.trim() || `sc-text-area-${instanceId}`);
const fieldErrors = computed(() => inputErrors(props.errorMessages));

function fieldAttrs() {
  return inputHtmlAttrs(attrs, {
    id: fieldId.value,
    hasMessages: fieldErrors.value.length > 0 || (!!props.hint && focused.value),
  });
}
function changeValue(value: unknown) {
  if (props.disabled || props.readonly) return;
  emit("update:modelValue", typeof value === "string" ? value : "");
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
@use "./input";

.sc-text-area {
  @include input.field;
}
</style>
