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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 현재 route.name에 맞는 운영 패널을 렌더링한다. v-if가 false인 컴포넌트의 setup과 Query도 생성되지 않는다.
 */

/**
 * Starter 운영 기능의 진입 화면이다. 세션 없음/기능 확인/권한 없음/기능별 패널을 나누고 로그인 입력도 여기서 처리한다.
 * 로그인은 공통 runtime.auth를 사용한다. VeeValidate 값에 Zod safeParse를 직접 적용하고 성공 후 입력값을 비운다.
 * 하위 Messages/Schedule/Browser 패널은 이 화면의 capability 조건을 통과한 경우에만 마운트된다. 실제 서버는 요청마다 권한을 확인한다.
 */

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
/**
 * 빈 입력을 먼저 안내하고 중복 제출을 막는다. auth.login이 CSRF/세션 생성/identity 갱신을 담당하므로 화면에서 fetch를 별도로 만들지 않는다.
 */
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
