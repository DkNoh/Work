<template>
  <div v-bind="pickScHtmlAttrs(attrs, { omit: ['role'] })" class="sc-error-panel" role="alert">
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <sc-action-button v-if="showRetry" variant="outlined" @click="emit('retry')">
      {{ retryLabel }}
    </sc-action-button>
  </div>
</template>
<script setup lang="ts">
import { useAttrs } from "vue";
import ScActionButton from "../ScActionButton.vue";
import { pickScHtmlAttrs } from "../contracts";
import type { ScErrorPanelProps, ScErrorPanelEmits } from "./contracts";
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<ScErrorPanelProps>(), {
  title: "조회하지 못했습니다",
  retryLabel: "다시 조회",
  showRetry: true,
});
const emit = defineEmits<ScErrorPanelEmits>();
const attrs = useAttrs();
</script>
<style scoped lang="scss">
.sc-error-panel {
  display: grid;
  justify-items: start;
  gap: var(--sc-space-3);
  padding: var(--sc-space-5);
  border: 1px solid var(--sc-color-error);
  border-radius: var(--sc-radius-md);
}
h2 {
  font-size: var(--sc-font-size-section);
}
p {
  overflow-wrap: anywhere;
}
</style>
