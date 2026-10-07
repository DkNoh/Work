<template>
  <section class="sc-stack">
    <sc-page-header :title="t('title')" />
    <form
      v-if="!runtime.session.identity"
      novalidate
      class="operations-login sc-stack"
      :aria-label="t('login')"
      @submit.prevent="login"
    >
      <sc-text-field
        v-model="username"
        :label="t('username')"
        autocomplete="username"
        :error-messages="form.errors.value.username"
        :disabled="busy"
        required
      />
      <sc-text-field
        v-model="password"
        :label="t('password')"
        type="password"
        autocomplete="current-password"
        :error-messages="form.errors.value.password"
        :disabled="busy"
        required
      />
      <sc-form-actions
        :busy="busy"
        :busy-label="t('processing')"
        :show-cancel="false"
        :submit-label="t('loginButton')"
      />
    </form>
    <p v-else-if="access.query.isPending.value" role="status">{{ t("loading") }}</p>
    <v-alert v-else-if="access.query.isError.value" type="error" role="alert">
      {{ access.query.error.value?.message }}
      <sc-action-button variant="text" @click="access.query.refetch()">
        {{ t("retry") }}
      </sc-action-button>
    </v-alert>
    <p v-else-if="!access.admin.value" role="status">{{ t("denied") }}</p>
    <template v-else>
      <nav class="sc-actions" :aria-label="t('title')">
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
      <messages-panel v-if="route.name === 'operations-messages' && access.messaging.value" />
      <schedule-panel v-else-if="route.name === 'operations-schedules' && access.scheduler.value" />
      <browser-panel
        v-else-if="route.name === 'operations-browser-errors' && access.browserErrors.value"
      />
      <p v-else role="status">{{ t("disabled") }}</p>
    </template>
    <v-alert v-if="error" type="error" role="alert">{{ error }}</v-alert>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useForm } from "vee-validate";
import { z } from "zod";
import { useI18n } from "vue-i18n";
import { useFrameworkRuntime } from "@sc/runtime";
import { ScActionButton, ScFormActions, ScPageHeader, ScTextField } from "@sc/ui";
import { useOperationsAccess } from "./capabilities";
import { messages } from "./messages";
import MessagesPanel from "./MessagesPanel.vue";
import SchedulePanel from "./SchedulePanel.vue";
import BrowserPanel from "./BrowserPanel.vue";
const runtime = useFrameworkRuntime();
const access = useOperationsAccess();
const route = useRoute();
const { t } = useI18n({ useScope: "local", messages });
const form = useForm({ initialValues: { username: "", password: "" } });
const [username] = form.defineField("username");
const [password] = form.defineField("password");
const busy = ref(false);
const error = ref("");
async function login() {
  if (busy.value) return;
  const result = z
    .object({ username: z.string().min(1), password: z.string().min(1) })
    .safeParse(form.values);
  if (!result.success) {
    form.setErrors(
      Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), t("invalid")])),
    );
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    await runtime.auth.login(result.data.username, result.data.password);
    form.resetForm();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t("invalid");
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.operations-login {
  max-width: 30rem;
}
</style>
