<template>
  <span
    v-bind="pickScHtmlAttrs(attrs, { omit: ['role', 'aria-live', 'aria-atomic', 'aria-relevant'] })"
    class="sc-status-badge"
    :data-tone="tone"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { useAttrs } from "vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScStatusBadgeProps, ScStatusBadgeSlots } from "./contracts";

defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScStatusBadgeProps>(), { tone: "neutral" });
defineSlots<ScStatusBadgeSlots>();
const attrs = useAttrs();
</script>

<style scoped lang="scss">
.sc-status-badge {
  --sc-badge-tone: var(--sc-color-text-muted);
  --sc-badge-foreground: var(--sc-badge-tone);
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: calc(var(--sc-space-1) / 2) var(--sc-space-2);
  border-radius: var(--sc-radius-sm);
  color: var(--sc-badge-foreground);
  background: color-mix(in srgb, var(--sc-badge-tone) 8%, var(--sc-color-surface));
  font-size: var(--sc-font-size-small);
  font-weight: var(--sc-font-weight-semibold);
  line-height: var(--sc-line-height-body);
  overflow-wrap: anywhere;

  &[data-tone="primary"] {
    --sc-badge-tone: var(--sc-color-primary);
  }
  &[data-tone="secondary"] {
    --sc-badge-tone: var(--sc-color-secondary);
    --sc-badge-foreground: var(--sc-color-on-secondary);
  }
  &[data-tone="success"] {
    --sc-badge-tone: var(--sc-color-success);
  }
  &[data-tone="warning"] {
    --sc-badge-tone: var(--sc-color-warning);
  }
  &[data-tone="danger"] {
    --sc-badge-tone: var(--sc-color-error);
  }
  &[data-tone="info"] {
    --sc-badge-tone: var(--sc-color-info);
  }
}
</style>
