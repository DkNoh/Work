<template>
  <div
    v-if="presentation === 'toolbar'"
    v-bind="toolbarContainerAttrs()"
    class="sc-select sc-select--toolbar"
    :data-density="density"
    :data-tone="tone"
  >
    <label :id="`${fieldId}-label`" :for="fieldId" class="sc-select__sr-only">{{ label }}</label>
    <div class="sc-select__control">
      <select
        v-bind="toolbarFieldAttrs()"
        :id="fieldId"
        :value="modelValue ?? ''"
        :name="disabled || readonly ? undefined : name"
        :form="form"
        :disabled="disabled || readonly"
        :required="required"
        :autofocus="autofocus"
        :aria-label="label"
        :aria-invalid="fieldErrors.length > 0 || undefined"
        :aria-required="required || undefined"
        :aria-disabled="disabled || readonly || undefined"
        :aria-readonly="readonly || undefined"
        :aria-busy="loading || undefined"
        @focus="focusField"
        @blur="blurField"
        @keydown="emit('keydown', $event)"
        @keyup="emit('keyup', $event)"
        @change="selectToolbarValue"
      >
        <option
          v-if="modelValue === null || placeholder || clearable || !options.length"
          value=""
          :disabled="!clearable"
        >
          {{
            loading && !options.length ? "…" : placeholder || (!options.length ? emptyLabel : label)
          }}
        </option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>
      <svg class="sc-select__chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m7 10 5 5 5-5" />
      </svg>
    </div>
    <!-- native select는 readonly가 없어 편집을 막고 성공적인 form 값은 별도 유지한다. -->
    <input
      v-if="readonly && !disabled && name"
      type="hidden"
      :name="name"
      :form="form"
      :value="modelValue ?? ''"
    />
    <div
      v-if="fieldErrors.length || hint"
      :id="`${fieldId}-messages`"
      class="sc-select__messages"
      :data-error="fieldErrors.length > 0 || undefined"
    >
      <template v-if="fieldErrors.length">
        <span v-for="(message, index) in fieldErrors" :key="index">{{ message }}</span>
      </template>
      <span v-else>{{ hint }}</span>
    </div>
  </div>
  <v-select
    v-else
    v-bind="fieldAttrs()"
    :id="fieldId"
    class="sc-select"
    :data-density="density"
    :density="density"
    variant="outlined"
    color="primary"
    :model-value="modelValue"
    :items="selectItems"
    :label="label"
    :error-messages="fieldErrors"
    :max-errors="fieldErrors.length"
    :hint="hint"
    :required="required"
    :disabled="disabled"
    :readonly="readonly"
    :name="disabled ? undefined : name"
    :form="form"
    :placeholder="placeholder"
    :autofocus="autofocus"
    :clearable="clearable"
    :loading="loading"
    :no-data-text="emptyLabel"
    :aria-invalid="fieldErrors.length > 0 || undefined"
    :aria-required="required || undefined"
    :aria-disabled="disabled || undefined"
    :aria-readonly="readonly || undefined"
    @focus="focusField"
    @blur="blurField"
    @keydown="emit('keydown', $event)"
    @keyup="emit('keyup', $event)"
    @update:model-value="selectValue"
  />
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * presentation에 따라 toolbar의 native select 또는 일반 폼의 Vuetify select를 표시한다.
 * v-for는 부모 options를 반복하고 :key에는 안정적인 value를 쓴다. 빈 선택은 clearable일 때만 사용자가 고를 수 있다.
 * readonly인 native select는 편집을 막되 hidden input으로 폼 제출값을 유지한다.
 */

/*
 * 선택값 원본은 부모의 string|null 모델이다. null은 선택 없음이며 서버 조회/옵션 로딩은 소비 앱 책임이다.
 *  computed는 공통 옵션을 Vuetify의 title/value/props 형식으로 변환하므로 공급업체 자료형을 공용 API에 노출하지 않는다.
 *  toolbar와 field는 표현만 다르고 selectValue를 통해 같은 변경 규칙을 사용한다.
 */
import { computed, ref, useAttrs, useId } from "vue";
import { VSelect } from "vuetify/components";
import { inputErrors, inputHtmlAttrs } from "./input-accessibility";
import { pickScHtmlAttrs } from "../contracts";
import type { ScSelectProps, ScSelectEmits, ScSelectSlots } from "./input-contracts";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScSelectProps>(), {
  errorMessages: "",
  hint: "",
  required: false,
  disabled: false,
  readonly: false,
  autofocus: false,
  clearable: false,
  loading: false,
  emptyLabel: "선택할 항목이 없습니다.",
  density: "comfortable",
  presentation: "field",
  tone: "surface",
});
const emit = defineEmits<ScSelectEmits>();
defineSlots<ScSelectSlots>();
const attrs = useAttrs();
const instanceId = useId();
const focused = ref(false);
const fieldId = computed(() => props.id?.trim() || `sc-select-${instanceId}`);
const fieldErrors = computed(() => inputErrors(props.errorMessages));
// map은 새 표시 배열을 만든다. readonly options를 수정하지 않으며 옵션별 disabled도 접근성 상태와 함께 변환한다.
const selectItems = computed(() =>
  props.options.map((option) => ({
    title: option.label,
    value: option.value,
    props: {
      disabled: option.disabled ?? false,
      "aria-disabled": option.disabled ? "true" : undefined,
    },
  })),
);

function fieldAttrs() {
  return inputHtmlAttrs(attrs, {
    id: fieldId.value,
    hasMessages: fieldErrors.value.length > 0 || (!!props.hint && focused.value),
    reserved: ["aria-controls", "aria-expanded", "aria-haspopup", "aria-autocomplete"],
  });
}
// toolbar는 바깥 div와 실제 select가 분리돼 있다. class/style/data는 컨테이너에, 의미 있는 입력 ARIA는 select에 전달한다.
function toolbarContainerAttrs() {
  return Object.fromEntries(
    Object.entries(attrs).filter(
      ([name]) => name === "class" || name === "style" || /^data-/.test(name),
    ),
  );
}
// native select의 명시 label과 메시지를 연결한다. 외부 ARIA가 필수 내부 상태나 label을 제거하지 못하도록 병합한다.
function toolbarFieldAttrs() {
  const forwarded = pickScHtmlAttrs(attrs, {
    omit: [
      "class",
      "style",
      "role",
      "aria-label",
      "aria-labelledby",
      "aria-describedby",
      "aria-invalid",
      "aria-required",
      "aria-disabled",
      "aria-readonly",
      "aria-busy",
      "aria-controls",
      "aria-expanded",
      "aria-haspopup",
      "aria-autocomplete",
    ],
  });
  const description =
    typeof attrs["aria-describedby"] === "string"
      ? attrs["aria-describedby"].trim().split(/\s+/).filter(Boolean)
      : [];
  if (fieldErrors.value.length || props.hint) description.push(`${fieldId.value}-messages`);
  if (description.length) forwarded["aria-describedby"] = [...new Set(description)].join(" ");
  // aria-labelledby는 명시 label과 외부 설명을 합칠 때만 허용한다.
  if (typeof attrs["aria-labelledby"] === "string" && attrs["aria-labelledby"].trim()) {
    forwarded["aria-labelledby"] = [
      ...new Set([`${fieldId.value}-label`, ...attrs["aria-labelledby"].trim().split(/\s+/)]),
    ].join(" ");
  }
  return forwarded;
}
// 브라우저 select는 문자열만 반환하므로 빈 문자열을 공통 null 계약으로 해석한다.
// as HTMLSelectElement는 이 이벤트를 발생시킨 DOM 요소의 타입을 알려 주는 단언이며 값을 변환하지 않는다.
function selectToolbarValue(event: Event) {
  const target = event.target as HTMLSelectElement;
  const value =
    target.value === "" && !props.options.some((option) => option.value === "")
      ? null
      : target.value;
  if (value === null && !props.clearable) {
    target.value = props.modelValue ?? "";
    return;
  }
  selectValue(value);
  // 프로그램 이벤트로 readonly/알 수 없는 값을 넣어도 화면을 부모의 값으로 복원한다.
  target.value = props.modelValue ?? "";
}
// 옵션에 없는 값·disabled 옵션·중복 값은 거절한다. emit은 부모에게 변경을 요청하며 부모 prop을 직접 갱신하지 않는다.
function selectValue(value: unknown) {
  if (props.disabled || props.readonly || (value !== null && typeof value !== "string")) return;
  if (value === props.modelValue) return;
  const option = props.options.find((item) => item.value === value);
  if (value !== null && (!option || option.disabled)) return;
  emit("update:modelValue", value);
  emit("change", value);
}
function focusField(event: FocusEvent) {
  focused.value = true;
  emit("focus", event);
}
function blurField(event: FocusEvent) {
  focused.value = false;
  emit("blur", event);
}
</script>

<style scoped lang="scss">
@use "./input";

.sc-select {
  @include input.field;
}
.sc-select--toolbar {
  --sc-toolbar-height: var(--sc-control-height-md);
  --sc-toolbar-color: var(--sc-color-text);
  --sc-toolbar-background: var(--sc-color-surface);
  --sc-toolbar-border: var(--sc-color-control-border);
  width: auto;
  min-width: 0;
  &[data-density="compact"] {
    --sc-toolbar-height: var(--sc-control-height-sm);
  }
  &[data-tone="primary"] {
    --sc-toolbar-color: var(--sc-color-on-primary);
    --sc-toolbar-background: var(--sc-color-primary);
    --sc-toolbar-border: var(--sc-color-primary);
  }
  &[data-tone="secondary"] {
    --sc-toolbar-color: var(--sc-color-on-secondary);
    --sc-toolbar-background: var(--sc-color-secondary);
    --sc-toolbar-border: var(--sc-color-secondary);
  }
  select {
    width: 100%;
    height: var(--sc-toolbar-height);
    min-width: 0;
    padding-block: 0;
    padding-inline: var(--sc-control-padding-sm)
      calc(var(--sc-control-padding-sm) + var(--sc-control-icon-md) + var(--sc-space-1));
    border: 1px solid var(--sc-toolbar-border);
    border-radius: var(--sc-radius-sm);
    appearance: none;
    color: var(--sc-toolbar-color);
    background: var(--sc-toolbar-background);
    font-family: var(--sc-font-family);
    font-size: var(--sc-control-font-md);
    font-weight: var(--sc-font-weight-medium);
    transition: border-color var(--sc-motion-duration) var(--sc-motion-easing);
    &:focus-visible {
      outline: 2px solid var(--sc-color-focus);
      outline-offset: 3px;
    }
    &[aria-invalid="true"] {
      border-color: var(--sc-color-error);
    }
    &:disabled {
      cursor: default;
      opacity: var(--sc-emphasis-disabled, 0.5);
    }
    option {
      color: var(--sc-color-text);
      background: var(--sc-color-surface);
    }
  }
}
.sc-select__control {
  position: relative;
}
.sc-select__chevron {
  position: absolute;
  inset-inline-end: var(--sc-control-padding-sm);
  top: 50%;
  width: var(--sc-control-icon-md);
  height: var(--sc-control-icon-md);
  transform: translateY(-50%);
  pointer-events: none;
  fill: none;
  stroke: var(--sc-toolbar-color);
  stroke-width: 2;
}
.sc-select__messages {
  display: flex;
  flex-direction: column;
  margin-top: var(--sc-space-1);
  color: var(--sc-color-text-muted);
  font-size: var(--sc-font-size-small);
  line-height: var(--sc-line-height-body);
  &[data-error="true"] {
    color: var(--sc-color-error);
  }
}
.sc-select__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
