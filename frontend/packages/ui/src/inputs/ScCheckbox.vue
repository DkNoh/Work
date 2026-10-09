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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * boolean 체크 입력을 표시한다. #label은 Vuetify의 label slot을 채워 고유 label ID를 보장한다.
 * true-value/false-value를 명시해 문자열 체크값이 부모 모델로 섞이지 않게 한다.
 */

/*
 * 동의 여부 등 업무 boolean은 부모가 소유한다. 이 컴포넌트는 boolean 변경과 포커스 이벤트만 전달한다.
 *  useId/computed는 label·오류의 접근성 연결을, ref는 포커스 동안 표시할 hint 상태를 관리한다.
 */
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

// aria-checked는 실제 체크 상태와 같아야 하므로 외부 attrs가 덮어쓰지 못하게 예약한다.
function fieldAttrs() {
  return inputHtmlAttrs(attrs, {
    id: fieldId.value,
    hasMessages: fieldErrors.value.length > 0 || (!!props.hint && focused.value),
    reserved: ["aria-checked"],
  });
}
// unknown을 boolean으로 좁힌 뒤 emit한다. null/문자열 또는 읽기 전용 상태의 변경은 부모에게 전달하지 않는다.
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
