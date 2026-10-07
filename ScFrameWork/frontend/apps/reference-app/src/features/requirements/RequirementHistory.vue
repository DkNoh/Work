<template>
  <ol class="history-list" :aria-label="t('request.history')">
    <li v-for="entry in history" :key="entry.id">
      <p>{{ entry.action }} · {{ entry.actorName }} · {{ formatDate(entry.createdAt) }}</p>
      <details>
        <summary>{{ t("request.snapshot") }}</summary>
        <h3>{{ t("request.before") }}</h3>
        <pre>{{ prettySnapshot(entry.beforeJson) }}</pre>
        <h3>{{ t("request.after") }}</h3>
        <pre>{{ prettySnapshot(entry.afterJson) }}</pre>
      </details>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { RequirementDetail } from "./api";
defineProps<{
  history: RequirementDetail["history"];
  formatDate: (value: string | null) => string;
}>();
const { t } = useI18n({ useScope: "global" });
function prettySnapshot(raw: string | null) {
  if (raw === null) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
</script>

<style scoped>
.history-list {
  margin: 0;
  padding-left: var(--sc-space-6);
}
summary {
  min-height: 44px;
  display: list-item;
  align-content: center;
  cursor: pointer;
}
pre {
  max-width: 100%;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--sc-font-size-small);
}
</style>
