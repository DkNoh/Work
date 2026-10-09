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
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * submit.prevent는 브라우저 기본 form 요청 대신 signIn을 실행한다. busy 동안 입력/중복 요청을 막고 실패를 role=alert로 알린다.
 */

/**
 * 생성 앱의 세션 로그인 화면이다. username/password는 브라우저 폼 초안 ref이고 서버 계정 정보는 runtime.auth.login이 확인한다.
 * ref는 script에서 .value, template에서는 자동 해제하여 사용한다. 성공/실패 모두 finally에서 비밀번호 초안을 지운다.
 * 서버 비밀번호 초기값을 코드에 넣지 않는다. runtime이 CSRF 획득·쿠키 로그인·사용자 조회·세션 세대 변경을 함께 처리한다.
 */

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
