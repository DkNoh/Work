<template>
  <div
    v-bind="pickScHtmlAttrs(attrs, { omit: ['role', 'aria-busy', 'aria-live'] })"
    class="sc-loading-state"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <v-progress-circular indeterminate size="24" color="primary" aria-hidden="true" />
    <span>{{ label }}</span>
  </div>
</template>
<script setup lang="ts">
import { useAttrs } from "vue";
import { VProgressCircular } from "vuetify/components";
import { pickScHtmlAttrs } from "../contracts";
import type { ScLoadingStateProps } from "./contracts";
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScLoadingStateProps>(), { label: "자료 불러오는 중…" });
const attrs = useAttrs();
</script>
<style scoped lang="scss">
.sc-loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sc-space-3);
  padding: var(--sc-space-8);
  color: var(--sc-color-text-muted);
}
</style>
