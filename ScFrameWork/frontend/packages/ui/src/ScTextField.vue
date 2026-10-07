<template>
  <v-text-field
    v-bind="fieldAttrs()"
    :id="fieldId"
    class="sc-text-field"
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
    :type="type"
    :name="name"
    :autocomplete="autocomplete"
    :form="form"
    :placeholder="placeholder"
    :maxlength="maxLength"
    :minlength="minLength"
    :pattern="pattern"
    :inputmode="inputMode"
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
  />
</template>

<script setup lang="ts">
import { computed, ref, useAttrs, useId } from "vue";
import { VTextField } from "vuetify/components";
import {
  pickScHtmlAttrs,
  type ScTextFieldProps,
  type ScTextFieldEmits,
  type ScTextFieldSlots,
} from "./contracts";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScTextFieldProps>(), {
  id: undefined,
  errorMessages: "",
  hint: "",
  required: false,
  disabled: false,
  readonly: false,
  type: "text",
  name: undefined,
  autocomplete: undefined,
  form: undefined,
  placeholder: undefined,
  maxLength: undefined,
  minLength: undefined,
  pattern: undefined,
  inputMode: undefined,
  autofocus: false,
  density: "comfortable",
});
const emit = defineEmits<ScTextFieldEmits>();
defineSlots<ScTextFieldSlots>();
const attrs = useAttrs();
const localId = useId();
const focused = ref(false);
const fieldId = computed(() => props.id?.trim() || `sc-field-${localId}`);
const fieldErrors = computed(() => {
  const messages =
    typeof props.errorMessages === "string" ? [props.errorMessages] : props.errorMessages;
  return messages.filter((message) => message.length > 0);
});

function fieldAttrs() {
  const forwarded = pickScHtmlAttrs(attrs, {
    omit: [
      "role",
      "aria-describedby",
      "aria-labelledby",
      "aria-invalid",
      "aria-required",
      "aria-disabled",
      "aria-readonly",
    ],
  });
  const externalDescription = attrs["aria-describedby"];
  if (typeof externalDescription === "string" && externalDescription.trim()) {
    const ids = externalDescription.trim().split(/\s+/);
    if (fieldErrors.value.length || (props.hint && focused.value))
      ids.push(`${fieldId.value}-messages`);
    forwarded["aria-describedby"] = [...new Set(ids)].join(" ");
  }
  const externalLabel = attrs["aria-labelledby"];
  if (typeof externalLabel === "string" && externalLabel.trim()) {
    forwarded["aria-labelledby"] = [
      ...new Set([`${fieldId.value}-label`, ...externalLabel.trim().split(/\s+/)]),
    ].join(" ");
  }
  return forwarded;
}

function changeValue(value: unknown) {
  // 자식에서의 편집은 제한하지만 부모의 modelValue 교체는 그대로 표시한다.
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
@use "./inputs/input";

.sc-text-field {
  @include input.field;
}
</style>
