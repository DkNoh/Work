<template>
  <section class="sc-content sc-stack" aria-labelledby="login-title">
    <sc-page-header id="login-title" :title="t('title')" />
    <form class="sc-stack login-form" :aria-label="t('title')" @submit.prevent="signIn">
      <sc-text-field
        v-model="username"
        :label="t('username')"
        name="username"
        autocomplete="username"
        :disabled="busy"
        required
      />
      <sc-text-field
        v-model="password"
        :label="t('password')"
        name="password"
        type="password"
        autocomplete="current-password"
        :disabled="busy"
        required
      />
      <p v-if="message" role="alert">{{ message }}</p>
      <sc-action-button type="submit" :busy="busy" :busy-label="t('busy')">
        {{ t("title") }}
      </sc-action-button>
    </form>
  </section>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError, useFrameworkRuntime } from "@sc/runtime";
import { ScActionButton, ScTextField, ScPageHeader } from "@sc/ui";
const runtime = useFrameworkRuntime();
const { t } = useI18n({
  useScope: "local",
  inheritLocale: true,
  messages: {
    ko: {
      title: "로그인",
      username: "사용자 이름",
      password: "비밀번호",
      busy: "로그인 중",
      failed: "로그인할 수 없습니다.",
    },
    en: {
      title: "Sign in",
      username: "Username",
      password: "Password",
      busy: "Signing in",
      failed: "Unable to sign in.",
    },
  },
});
const username = ref("admin");
const password = ref("");
const busy = ref(false);
const message = ref("");
async function signIn() {
  if (busy.value) return;
  busy.value = true;
  message.value = "";
  try {
    await runtime.auth.login(username.value, password.value);
    password.value = "";
    await runtime.router.replace("/notes");
  } catch (error) {
    message.value = error instanceof ApiError ? error.message : t("failed");
  } finally {
    password.value = "";
    busy.value = false;
  }
}
</script>
<style scoped>
.login-form {
  max-width: 480px;
}
</style>
