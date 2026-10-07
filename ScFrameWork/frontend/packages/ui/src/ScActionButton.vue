<template>
  <v-btn
    v-bind="buttonAttrs()"
    class="sc-action-button"
    :data-size="size"
    :data-intent="intent"
    :data-icon-only="iconOnly || undefined"
    :data-custom-color="color !== undefined || undefined"
    :type="type"
    :color="buttonColor"
    :variant="variant"
    :disabled="disabled || busy"
    :loading="busy"
    :aria-busy="busy"
    @click="clickAction"
  >
    <span v-if="busy" :class="{ 'sc-action-button__sr-only': iconOnly }">{{ busyLabel }}</span>
    <template v-else>
      <svg
        v-if="iconPath"
        class="sc-action-button__icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path :d="iconPath" />
      </svg>
      <slot v-if="!iconOnly" />
    </template>
    <template #loader>
      <v-progress-circular indeterminate :width="2" :aria-label="busyLabel" />
    </template>
  </v-btn>
</template>

<script setup lang="ts">
import { computed, nextTick, useAttrs } from "vue";
import { VBtn, VProgressCircular } from "vuetify/components";
import {
  pickScHtmlAttrs,
  type ScActionButtonProps,
  type ScActionButtonEmits,
  type ScActionButtonSlots,
} from "./contracts";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<ScActionButtonProps>(), {
  busy: false,
  busyLabel: "처리 중…",
  disabled: false,
  type: "button",
  variant: "flat",
  size: "md",
  intent: "primary",
  iconOnly: false,
});
const emit = defineEmits<ScActionButtonEmits>();
defineSlots<ScActionButtonSlots>();
const attrs = useAttrs();
let clickPending = false;
const buttonColor = computed(() => {
  if (props.color !== undefined) return props.color;
  if (props.intent === "danger") return "error";
  if (props.intent === "neutral") return "surface-variant";
  // 작은 보라색 글자도 밝은 표면에서 읽히도록 비채움 상태는 진한 의미색을 쓴다.
  if (props.intent === "secondary" && props.variant !== "flat") return "info";
  return props.intent;
});

function buttonAttrs() {
  const forwarded = pickScHtmlAttrs(attrs, {
    attributes: [
      "id",
      "name",
      "value",
      "form",
      "autofocus",
      "formaction",
      "formenctype",
      "formmethod",
      "formnovalidate",
      "formtarget",
      "popovertarget",
      "popovertargetaction",
    ],
    events: ["onFocus", "onBlur", "onKeydown", "onKeyup"],
    omit: [
      "aria-busy",
      "aria-disabled",
      "data-size",
      "data-intent",
      "data-icon-only",
      "data-custom-color",
    ],
  });
  if (props.iconOnly) {
    const label = typeof attrs["aria-label"] === "string" ? attrs["aria-label"].trim() : "";
    const title = typeof attrs.title === "string" ? attrs.title.trim() : "";
    if (!props.iconPath?.trim() || !(label || title)) {
      throw new Error(
        "ScActionButton iconOnly requires iconPath and a non-empty aria-label or title.",
      );
    }
    delete forwarded["aria-labelledby"];
    forwarded["aria-label"] = props.busy ? props.busyLabel : label || title;
  }
  return forwarded;
}

function clickAction(event: MouseEvent) {
  if (props.disabled || props.busy || clickPending) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (event.defaultPrevented) return;
  // 부모가 busy를 갱신하는 렌더 전의 연속 클릭도 중복 전달하지 않는다.
  clickPending = true;
  try {
    emit("click", event);
  } finally {
    void nextTick(() => {
      clickPending = false;
    });
  }
}
</script>

<style scoped lang="scss">
.sc-action-button {
  --sc-button-height: var(--sc-control-height-md);
  --sc-button-padding: var(--sc-control-padding-md);
  --sc-button-icon: var(--sc-control-icon-md);
  --sc-button-gap: var(--sc-control-gap-md);
  --sc-button-font: var(--sc-control-font-md);
  --v-btn-height: var(--sc-button-height);
  height: var(--sc-button-height);
  min-width: 5rem;
  padding-inline: var(--sc-button-padding);
  border-radius: var(--sc-radius-sm);
  font-size: var(--sc-button-font);
  font-weight: var(--sc-font-weight-semibold);
  text-transform: none;
  letter-spacing: 0;
  transition-duration: var(--sc-motion-duration);
  transition-timing-function: var(--sc-motion-easing);

  &[data-size="sm"] {
    --sc-button-height: var(--sc-control-height-sm);
    --sc-button-padding: var(--sc-control-padding-sm);
    --sc-button-icon: var(--sc-control-icon-sm);
    --sc-button-gap: var(--sc-control-gap-sm);
    --sc-button-font: var(--sc-control-font-sm);
  }
  &[data-size="lg"] {
    --sc-button-height: var(--sc-control-height-lg);
    --sc-button-padding: var(--sc-control-padding-lg);
    --sc-button-icon: var(--sc-control-icon-lg);
    --sc-button-gap: var(--sc-control-gap-lg);
    --sc-button-font: var(--sc-control-font-lg);
  }
  &[data-icon-only="true"] {
    width: var(--sc-button-height);
    min-width: var(--sc-button-height);
    padding-inline: 0;
  }
  &[data-intent="neutral"]:not([data-custom-color]) {
    color: var(--sc-color-text);
    &.v-btn--variant-outlined {
      border-color: var(--sc-color-control-border);
    }
  }
  :deep(.v-btn__content) {
    gap: var(--sc-button-gap);
  }
  :deep(.v-progress-circular) {
    width: var(--sc-button-icon);
    height: var(--sc-button-icon);
  }
  &:focus-visible {
    outline: 2px solid var(--sc-color-focus);
    outline-offset: 3px;
  }
}
.sc-action-button__icon {
  flex: 0 0 auto;
  width: var(--sc-button-icon);
  height: var(--sc-button-icon);
  fill: currentColor;
}
.sc-action-button__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
