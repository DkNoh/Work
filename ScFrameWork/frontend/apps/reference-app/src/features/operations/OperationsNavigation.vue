<template>
  <nav :aria-label="t('operations')" class="operations-navigation">
    <router-link v-if="access.messaging.value" to="/operations/messages">
      {{ t("messages") }}
    </router-link>
    <router-link v-if="access.scheduler.value" to="/operations/schedules">
      {{ t("schedules") }}
    </router-link>
    <router-link v-if="access.browserErrors.value" to="/operations/browser-errors">
      {{ t("browserErrors") }}
    </router-link>
  </nav>
</template>
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useOperationsAccess } from "./capabilities";
import { operationMessages } from "./messages";
const { t } = useI18n({ useScope: "local", messages: operationMessages });
const access = useOperationsAccess();
</script>
<style scoped>
.operations-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sc-space-4);
}
.operations-navigation a {
  padding: var(--sc-space-2);
}
</style>
