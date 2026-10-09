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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 여러 줄 입력도 모델·오류·focus 이벤트는 단일 입력과 같다. rows/auto-grow는 화면 높이만 조절한다.
 * 업무상 최대 글자 수 검증과 저장은 부모 폼이 맡는다.
 */

/*
 * 읽기 전용 props를 Vuetify textarea에 연결하는 문자열 입력 어댑터다.
 *  defineEmits로 update:modelValue와 DOM 이벤트의 매개변수 타입을 제한한다. 로컬 ref는 hint 표시를 위한 focused 하나다.
 */
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
// 부모가 id/오류를 바꾸면 계산값만 다시 만든다. 원본 문자열을 로컬 상태로 복제하지 않는다.
const fieldId = computed(() => props.id?.trim() || `sc-text-area-${instanceId}`);
const fieldErrors = computed(() => inputErrors(props.errorMessages));

// 공통 helper가 내부 label/메시지 ID와 외부 ARIA 참조를 병합한다. attrs 변경을 놓치지 않도록 렌더마다 호출한다.
function fieldAttrs() {
  return inputHtmlAttrs(attrs, {
    id: fieldId.value,
    hasMessages: fieldErrors.value.length > 0 || (!!props.hint && focused.value),
  });
}
// disabled/readonly는 사용자 편집 emit을 제한한다. 부모가 새 modelValue를 보내는 것은 그대로 화면에 반영된다.
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
