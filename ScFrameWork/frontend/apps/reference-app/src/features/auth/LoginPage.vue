<template>
  <main class="login-page" aria-label="레퍼런스 로그인">
    <section class="login-welcome" aria-label="ScFramework 소개">
      <div class="login-welcome__brand">
        <span aria-hidden="true">Sc</span>
        ScFramework
      </div>
      <div class="login-welcome__content">
        <p class="login-eyebrow">YOUR WORKSPACE, CONNECTED</p>
        <h2>
          함께 만드는
          <br />
          더 나은 업무 흐름
        </h2>
        <p class="login-welcome__description">
          요구사항과 작업을 한곳에서 관리하고,
          <br />
          팀의 진행 현황을 확인하세요.
        </p>
        <svg class="login-illustration" viewBox="0 0 520 350" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient :id="illustrationGradientId" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stop-color="#ffffff" />
              <stop offset="1" stop-color="#eef1ff" />
            </linearGradient>
          </defs>
          <ellipse cx="263" cy="325" rx="203" ry="15" fill="#1e2853" opacity=".25" />
          <rect
            x="52"
            y="46"
            width="405"
            height="262"
            rx="16"
            :fill="`url(#${illustrationGradientId})`"
          />
          <path d="M68 46h65v262H68a16 16 0 0 1-16-16V62a16 16 0 0 1 16-16" fill="#546397" />
          <circle cx="91" cy="74" r="12" fill="#f4f6ff" />
          <path d="M88 70h7v7h-7z" fill="#7f67ff" />
          <rect x="68" y="110" width="49" height="9" rx="4" fill="#b9c4ea" />
          <rect x="68" y="133" width="49" height="9" rx="4" fill="#8d9ccb" />
          <rect x="68" y="156" width="38" height="9" rx="4" fill="#8d9ccb" />
          <rect x="68" y="179" width="44" height="9" rx="4" fill="#8d9ccb" />
          <rect x="151" y="67" width="133" height="10" rx="5" fill="#d9deef" />
          <circle cx="429" cy="72" r="10" fill="#a4d9c4" />
          <rect x="151" y="98" width="89" height="60" rx="8" fill="#e1f4eb" />
          <rect x="252" y="98" width="89" height="60" rx="8" fill="#ebe7ff" />
          <rect x="353" y="98" width="89" height="60" rx="8" fill="#fff0e2" />
          <rect x="165" y="114" width="24" height="24" rx="5" fill="#86d5b1" />
          <path
            d="m172 126 4 4 7-9"
            fill="none"
            stroke="#1a7851"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect x="266" y="114" width="24" height="24" rx="5" fill="#b8a8ff" />
          <path
            d="M273 120h10m-10 6h10m-10 6h7"
            stroke="#6550b4"
            stroke-width="2"
            stroke-linecap="round"
          />
          <rect x="367" y="114" width="24" height="24" rx="5" fill="#ffd395" />
          <circle cx="379" cy="124" r="5" fill="none" stroke="#aa7631" stroke-width="2" />
          <path d="M373 135q6-7 12 0" fill="none" stroke="#aa7631" stroke-width="2" />
          <rect x="151" y="173" width="191" height="112" rx="8" fill="#ffffff" />
          <path d="M168 258h158M168 235h158M168 212h158" stroke="#e9edf6" />
          <path d="m168 252 20-10 22 3 20-28 19 12 18-35 21 14 20-29 18 8v79H168z" fill="#eee9ff" />
          <path
            d="m168 252 20-10 22 3 20-28 19 12 18-35 21 14 20-29 18 8"
            fill="none"
            stroke="#8a70ef"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect x="353" y="173" width="89" height="112" rx="8" fill="#ffffff" />
          <circle cx="397" cy="217" r="25" fill="none" stroke="#ebe7ff" stroke-width="9" />
          <path
            d="M397 192a25 25 0 0 1 24 31"
            fill="none"
            stroke="#79c8a6"
            stroke-width="9"
            stroke-linecap="round"
          />
          <rect x="368" y="260" width="58" height="6" rx="3" fill="#e0e5f1" />
          <rect x="19" y="213" width="138" height="59" rx="12" fill="#ffffff" />
          <circle cx="43" cy="243" r="13" fill="#dbf4e6" />
          <path
            d="m37 243 4 4 8-9"
            fill="none"
            stroke="#219565"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect x="67" y="232" width="71" height="6" rx="3" fill="#a8b6d7" />
          <rect x="67" y="246" width="52" height="6" rx="3" fill="#dce3f2" />
          <circle cx="464" cy="138" r="26" fill="#ffdfa6" />
          <path d="M455 138h18m-9-9v18" stroke="#b6873e" stroke-width="3" stroke-linecap="round" />
        </svg>
      </div>
      <p class="login-welcome__footer">ScFramework · Your everyday workspace</p>
    </section>
    <section class="login-form-panel" aria-labelledby="login-title">
      <div class="login-form-panel__inner">
        <p class="login-mobile-brand">ScFramework</p>
        <p class="login-form-eyebrow">WELCOME BACK</p>
        <h1 id="login-title">로그인</h1>
        <p class="login-form-description">아이디와 비밀번호로 업무 공간에 접속하세요.</p>
        <!-- v-model이 username/password ref를 갱신한다. @submit.prevent는 form 기본 페이지 전송을 막고 loginUser를 한 번 호출한다. -->
        <form class="login-form" aria-label="로그인" @submit.prevent="loginUser">
          <sc-text-field v-model="username" label="아이디" autocomplete="username" required />
          <sc-text-field
            v-model="password"
            label="비밀번호"
            type="password"
            autocomplete="current-password"
            required
          />
          <v-alert v-if="error" type="error" role="alert">{{ error }}</v-alert>
          <sc-action-button type="submit" :busy="busy" busy-label="로그인 중…">
            로그인
          </sc-action-button>
        </form>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
/*
 * 화면(template) 조립 안내. 개발 모드의 단일 루트 구조를 유지하도록 설명은 script 주석에 둔다.
 * 로그인 전에는 App.vue가 일반 업무 셸 없이 이 main을 표시한다. 왼쪽 SVG는 장식이고 오른쪽 form이 실제 인증 입력이다.
 */

// 로그인 화면은 공통 runtime.auth를 호출하는 진입점이다. 사용자 입력 ref는 이 브라우저 화면에만 존재하며 서버 세션 그 자체가 아니다.
import { ref, useId } from "vue";
import { ScActionButton, ScTextField } from "@sc/ui";
import { useFrameworkRuntime } from "@sc/runtime";

const runtime = useFrameworkRuntime();
// ref("")는 변경을 추적하는 값 상자다. script에서 .value를 쓰고 template의 최상위 ref는 Vue가 자동으로 풀어 준다.
const username = ref("");
const password = ref("");
const busy = ref(false);
const error = ref("");
// useId는 같은 컴포넌트가 여러 번 생겨도 SVG gradient 참조 ID가 겹치지 않게 한다.
const illustrationGradientId = `login-illustration-${useId()}`;

// 제출 → busy로 중복 방지 → 공통 auth.login → 비밀번호 입력 비우기 → dashboard replace 순서다.
// 인증 HTTP·세션 갱신·CSRF 처리는 runtime이 맡으며 여기서 쿠키/토큰을 직접 생성하지 않는다.
async function loginUser() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await runtime.auth.login(username.value, password.value);
    password.value = "";
    await runtime.router.replace("/dashboard");
    // 실패하면 메시지를 표시하고 finally에서 버튼을 다시 활성화한다. cause가 Error인지 확인한 뒤 message를 읽는다.
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "로그인하지 못했습니다.";
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped lang="scss">
@use "@sc/ui/tokens" with (
  $sc-emit-css: false
);
.login-page {
  display: grid;
  grid-template-columns: minmax(0, 46%) minmax(0, 1fr);
  min-height: 100dvh;
  background: var(--sc-color-surface);
}
.login-welcome {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  padding: 36px 48px 24px;
  overflow: hidden;
  color: #ffffff;
  background: linear-gradient(145deg, #3b497e, #293662);
}
.login-welcome::before,
.login-welcome::after {
  position: absolute;
  content: "";
  width: 430px;
  height: 430px;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 50%;
  pointer-events: none;
}
.login-welcome::before {
  top: -220px;
  right: -200px;
}
.login-welcome::after {
  bottom: -290px;
  left: -150px;
  width: 590px;
  height: 590px;
}
.login-welcome__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.login-welcome__brand span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 50%;
  font-size: 14px;
  font-weight: 700;
}
.login-welcome__content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 520px;
  margin-inline: auto;
  padding-top: 44px;
}
.login-eyebrow {
  margin: 0 0 16px;
  color: #ccd5f0;
  font-size: 11px;
  letter-spacing: 0.14em;
}
.login-welcome h2 {
  margin: 0;
  color: #ffffff;
  font-size: clamp(28px, 2.6vw, 38px);
  font-weight: 600;
  line-height: 1.5;
}
.login-welcome__description {
  margin: 16px 0 12px;
  color: #dbe2f7;
  font-size: 14px;
  line-height: 1.9;
}
.login-illustration {
  display: block;
  width: 100%;
  max-height: 350px;
  margin-top: 20px;
}
.login-welcome__footer {
  position: relative;
  margin: 28px 0 0;
  color: #ccd5f0;
  font-size: 11px;
}
.login-form-panel {
  display: grid;
  align-items: center;
  justify-items: center;
  min-width: 0;
  padding: 48px;
}
.login-form-panel__inner {
  width: min(100%, 400px);
}
.login-mobile-brand {
  display: none;
}
.login-form-eyebrow {
  margin: 0 0 12px;
  color: var(--sc-color-primary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
}
.login-form-panel h1 {
  margin: 0 0 10px;
  font-size: 28px;
  font-weight: 600;
}
.login-form-description {
  margin: 0 0 32px;
  color: var(--sc-color-text-muted);
  font-size: 13px;
}
.login-form {
  display: grid;
  gap: 24px;
}
@media (max-width: calc(tokens.$sc-breakpoint-sm - 1px)) {
  .login-page {
    grid-template-columns: minmax(0, 1fr);
  }
  .login-welcome {
    display: none;
  }
  .login-form-panel {
    padding: 32px 24px;
  }
  .login-mobile-brand {
    display: block;
    margin: 0 0 48px;
    color: var(--sc-color-nav-background);
    font-size: 22px;
    font-weight: 600;
  }
  .login-form-panel h1 {
    font-size: 26px;
  }
}
</style>
