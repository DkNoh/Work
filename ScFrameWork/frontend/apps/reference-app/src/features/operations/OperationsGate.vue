<template>
  <p v-if="!runtime.session.identity || access.query.isPending.value" role="status">
    {{ t("checking") }}
  </p>
  <v-alert v-else-if="access.query.isError.value" type="error" role="alert">
    {{ access.query.error.value?.message }}
    <sc-action-button variant="text" @click="access.query.refetch()">
      {{ t("retry") }}
    </sc-action-button>
  </v-alert>
  <p v-else-if="!access.admin.value" role="status">{{ t("denied") }}</p>
  <p v-else-if="!allowed" role="status">{{ t("disabled") }}</p>
  <slot v-else />
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ScActionButton } from "@sc/ui";
import { useReferenceRuntime } from "../../auth/identity";
import { useOperationsAccess } from "./capabilities";
import { operationMessages } from "./messages";
defineProps<{ allowed: boolean }>();
const runtime = useReferenceRuntime();
const access = useOperationsAccess();
const { t } = useI18n({ useScope: "local", messages: operationMessages });
</script>
