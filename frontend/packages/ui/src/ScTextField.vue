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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 단일 문자열 입력: Vuetify 입력에 부모의 값·필드명·오류를 전달하고 focus/blur/입력 이벤트를 다시 전달한다.
 * v-model의 실제 연결은 :model-value 입력과 @update:model-value 출력의 쌍이다.
 */

/*
 * modelValue와 검증 오류는 소비 폼이 원본이다. 자식은 문자열을 emit할 뿐 props를 직접 변경하지 않는다.
 *  type으로 가져온 Props/Emits/Slots는 타입 검사에만 쓰이며 JS 번들에서는 제거된다.
 *  ref(false)는 이 필드의 포커스 상태만 저장한다. script에서는 .value로 읽고 template에서는 Vue가 자동으로 풀어 준다.
 */
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
// useId는 인스턴스마다 다른 ID를 준다. computed로 외부 id 변경도 반영해 label과 오류 설명의 연결을 유지한다.
const fieldId = computed(() => props.id?.trim() || `sc-field-${localId}`);
const fieldErrors = computed(() => {
  const messages =
    typeof props.errorMessages === "string" ? [props.errorMessages] : props.errorMessages;
  return messages.filter((message) => message.length > 0);
});

// 외부 aria-describedby/labelledby를 허용하되 내부 label·오류 ID와 합쳐 중복을 제거한다.
// 오류가 없으면 hint는 포커스 중일 때만 Vuetify 메시지 영역을 참조한다.
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

// unknown은 입력 라이브러리가 어떤 값이든 줄 수 있다는 뜻이다. typeof 검사로 문자열만 부모 모델에 보낸다.
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
