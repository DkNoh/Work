# SMS MFA 로그인: 추가 파일과 수정 부분만

작성일: 2026-10-07. 기준 SMS 경로는 `/home/dk/Work/omoWorker/`다.

**2026-10-07 제공된 `WEB-INF/login_mfa.jsp`를 분석하여 소켓 계약을 반영한 부분 적용 문서다.**
기존 A→B200 발급, C→D200 검증, SMSADMIN 채널과 요청 종료 신호를 확인했다.
실제 수정된 폐쇄망 로그인 소스를 통째로 교체하지 않으며, LDAP 성공 분기에 아래 추가분만 병합한다.
JSP의 역할별 대응과 남은 검증은 [JSP 분석 결과](JSP_분석현황.md)에 기록한다.

## 적용 원칙

- 제품 HTML은 기존 login.html 하나만 사용한다. JSP 전체 화면을 새 페이지로 옮기지 않는다.
- 실제 기존 submit 리스너의 LDAP 성공 분기에 MFA를 넣고, MFA 성공 뒤 기존 native submit을 실행한다.
- 전화번호 조회/번호 생성·검증은 독립 MFA 데몬이 담당한다. SMS는 서버 세션의 인증된 ID로 요청한다.
- `emp.mfa_yn` 분기는 제외한다.
- 수정된 실제 SMS에 아래 추가분을 병합한다. 원본 Controller/SecurityConfig/auth.css 전체 교체 파일은 제공하지 않는다.
- NEW_MFA/src는 독립 데몬이며 아래 SMS 코드를 복사하는 위치가 아니다.
- 현재 사본에는 local ID 인증과 dev/prod LDAP Provider가 있지만 AD AJAX login.js가 없다.
  실제 수정본에 있는 LDAP API/성공 조건을 보존하고 그 자리에 아래 hook을 넣는다.
  사본만으로 데모를 새로 구동하려면 별도 1차 인증 API가 필요하지만, 사용자 요청의 실소스가 이미 있으므로 여기서 가상의 API 구현으로 덮어쓰지 않는다.

## 추가·수정 파일 목록

경로는 실제 SMS 프로젝트 기준이다. 기존 파일이 다른 이름이면 역할이 같은 파일에 해당 부분만 적용한다.

| 파일 | 추가/수정 범위 |
| --- | --- |
| templates/login.html | 기존 form ID, 기존 입력 묶음, MFA hidden 영역, CSRF meta 및 공통 JS 로드 순서 |
| 기존 login.js | 초기화 2줄, 중복 진입 방지, LDAP 성공 뒤 submit 한 줄 교체 |
| static/css/login-mfa.css | MFA 영역의 스타일만 신규. 기존 --sms-* 토큰 사용 |
| static/js/auth/login-mfa.js | MFA 발급/검증/카운트다운 UI 모듈 신규. 기존 JS에 병합 가능 |
| 실제 LDAP 인증 Controller/Service | 인증 성공 지점에 서버 세션 대기 상태 저장; 기존 인증 처리는 보존 |
| 기존 LoginController 또는 실제 로그인 Controller | send/verify/cancel 메서드와 DTO만 추가 |
| auth/MfaLoginState.java | 서버의 ID/만료/횟수/완료 상태 신규 |
| auth/MfaTcpClient.java | 신규 데몬 TCP 클라이언트 |
| auth/MfaLoginGateFilter.java | 최종 POST /login 앞에서 MFA 완료 확인·일회성 소비 |
| config/SecurityConfig.java | MFA 세 경로 허용, 로그인 검사 필터 연결만 추가 |
| 기존 환경 설정 | MFA host/port/channel/timeout/TTL 키만 추가 |

위 Java package `com.scbk.sms.auth`는 스케폴드에 맞춘 예시다. endpoint 클래스 전체를 기존 Controller와 중복 등록하지 않는다.
동일한 역할의 공통 상태/클라이언트/필터가 실제 수정본에 있다면 해당 메서드에 병합한다.

## 1. login.html: 기존 화면에만 추가

기존 form의 action/method/name을 유지하고 `id="loginForm"`을 붙인다.
기존 사번·비밀번호 영역을 `<div data-login-credentials>...</div>`로 감싼다.
로그인 버튼에는 `id="loginButton"`을 붙인다. MFA 단계에서는 이 영역을 숨기되 input을 disabled로 만들지 않는다.
값은 마지막 native `submit()`에 그대로 포함된다.

head에 누락된 항목만 다음 순서로 추가한다. `defer`를 사용한 스크립트는 같은 순서로 실행된다.
기존 login.js가 이미 있다면 아래 태그를 중복 삽입하지 말고 실제 경로/로드 위치만 맞춘다.

```html
<meta name="_csrf" th:content="${_csrf.token}">
<meta name="_csrf_header" th:content="${_csrf.headerName}">
<!-- 기존 admin-common.css → auth.css 다음 -->
<link rel="stylesheet" th:href="@{/css/login-mfa.css}">
<script defer th:src="@{/lib/axios.min.js}"></script>
<!-- 기존 Notify를 사용 중이면 의존 라이브러리와 함께 이 앞에서 로드한다. -->
<script defer th:src="@{/js/common/http-client.js}"></script>
<script defer th:src="@{/js/auth/login-mfa.js}"></script>
<script defer th:src="@{/js/auth/login.js}"></script>
```

MFA 전용 스타일과 JS는 각각 `static/css/login-mfa.css`, `static/js/auth/login-mfa.js`로 추가하는 예시다.
원하면 JS 본문을 기존 login.js 앞에 합칠 수 있다. 공통 http-client.js는 수정하지 않는다.

기존 form 내부, 로그인 버튼 아래에 삽입:

```html
<!-- 기존 login.html의 form 내부에 삽입. 새 MFA 페이지를 만들지 않는다. -->
<section id="mfaArea" class="mfa-area" hidden aria-labelledby="mfaTitle">
    <ol class="mfa-steps" aria-label="로그인 단계">
        <li class="is-complete"><span aria-hidden="true">✓</span>계정 확인</li>
        <li aria-current="step"><span aria-hidden="true">2</span>본인 인증</li>
    </ol>
    <h2 id="mfaTitle">휴대전화 본인 인증</h2>
    <p class="mfa-description">등록된 휴대전화로 받은 인증번호를 입력해 주세요.</p>
    <div class="mfa-id-summary"><span>인증 계정</span><strong id="mfaEmpId"></strong><span class="mfa-badge">계정 확인 완료</span></div>
    <div class="mfa-code-heading">
        <label for="mfaCode">인증번호</label>
        <span id="mfaAttempts" class="mfa-attempts">확인 중</span>
    </div>
    <div class="mfa-code-control" id="mfaCodeControl">
        <input id="mfaCode" type="text" inputmode="numeric" pattern="[0-9]*"
               autocomplete="one-time-code" maxlength="6" placeholder="6자리 숫자"
               aria-describedby="mfaCodeHint mfaMessage" aria-invalid="false" disabled>
        <!-- 초마다 스크린리더가 읽지 않도록 live 영역과 분리한다. -->
        <span class="mfa-countdown" id="mfaTimer" role="timer" aria-live="off" aria-label="인증번호 남은 시간">--:--</span>
    </div>
    <p id="mfaCodeHint" class="mfa-hint">인증번호는 6자리 숫자입니다.</p>
    <p id="mfaMessage" class="mfa-message" role="status" aria-live="polite"></p>
    <button type="button" id="mfaVerifyButton" class="mfa-primary" disabled>인증하고 로그인</button>
    <div class="mfa-resend-row">
        <span>문자를 받지 못하셨나요?</span>
        <button type="button" id="mfaResendButton" class="mfa-resend" disabled>재전송</button>
    </div>
    <p id="mfaSendCount" class="mfa-send-count"></p>
    <button type="button" id="mfaRestartButton" class="mfa-restart">계정 인증부터 다시 하기</button>
</section>
```

인증번호에 `required`나 `name`을 붙이지 않는다. 최초 로그인 폼의 validation을 방해하거나 OTP를 최종 `/login`에 다시 보내지 않도록 한다.
입력은 숫자 키패드/자동완성/붙여넣기/Enter를 지원하며, 6자리 입력 전 확인 버튼을 비활성화한다.
타이머는 매초 스크린리더 알림을 발생시키지 않는다. 만료·오류 메시지만 live 영역으로 안내한다.
색상·폰트·간격은 기존 `--sms-*` 토큰을 사용한다.

신규 CSS 내용:

```css
/* 기존 admin-common.css → auth.css 다음에 적용. MFA 화면 범위의 스타일만 추가한다. */
.mfa-area[hidden], [data-login-credentials][hidden], #loginButton[hidden] { display: none !important; }
.login-panel.mfa-active { width: min(100%, 480px); }
.mfa-area { padding-top: 4px; }
.mfa-steps { display: flex; gap: 24px; list-style: none; padding: 0 0 24px; margin: 0 0 24px; border-bottom: 1px solid var(--sms-border-subtle); }
.mfa-steps li { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--sms-primary); }
.mfa-steps li span { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--sms-primary); color: white; }
.mfa-steps .is-complete { color: var(--sms-success); }
.mfa-steps .is-complete span { background: var(--sms-success-soft); color: var(--sms-success); }
.mfa-area h2 { margin: 0 0 10px; font-size: 22px; color: var(--sms-text-strong); line-height: 1.4; letter-spacing: -.03em; }
.mfa-description { margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: var(--sms-text-muted); word-break: keep-all; }
.mfa-id-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 12px; margin-bottom: 24px; border: 1px solid var(--sms-border-subtle); border-radius: var(--sms-radius); font-size: 12px; color: var(--sms-text-muted); background: var(--sms-bg-app); }
.mfa-id-summary strong { font-size: 14px; color: var(--sms-text-strong); }
.mfa-badge { margin-left: auto; color: var(--sms-success); font-size: 11px; font-weight: 600; }
.mfa-code-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.mfa-code-heading label { font-weight: 600; margin: 0; }
.mfa-attempts { font-size: 12px; color: var(--sms-text-muted); }
.mfa-code-control { position: relative; }
.login-form .mfa-code-control input { height: 56px; padding: 0 82px 0 14px; font-size: 24px; letter-spacing: .22em; font-variant-numeric: tabular-nums; }
.login-form .mfa-code-control input::placeholder { font-size: 14px; letter-spacing: 0; }
.mfa-countdown { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--sms-primary); font: 600 17px var(--sms-font-mono); font-variant-numeric: tabular-nums; }
.mfa-countdown.is-urgent, .mfa-area .is-error { color: var(--sms-danger); }
.login-form .mfa-code-control.is-invalid input { border-color: var(--sms-danger); }
.login-form .mfa-code-control.is-invalid input:focus { box-shadow: 0 0 0 3px rgba(var(--sms-danger-rgb), .12); }
.mfa-hint { margin: 8px 0 0; font-size: 12px; color: var(--sms-text-muted); }
.mfa-message { min-height: 38px; margin: 10px 0 16px; font-size: 13px; line-height: 1.5; color: var(--sms-text-muted); word-break: keep-all; }
.mfa-message.is-success { color: var(--sms-success); }
.mfa-area button { font-family: inherit; cursor: pointer; }
.mfa-primary { width: 100%; min-height: 48px; border: 0; border-radius: var(--sms-radius); background: var(--sms-primary); color: white; font-size: 15px; font-weight: 600; }
.mfa-primary:hover:enabled { background: var(--sms-primary-hover); }
.mfa-primary:disabled { opacity: .48; cursor: not-allowed; }
.mfa-resend-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-top: 18px; color: var(--sms-text-muted); font-size: 12px; }
.mfa-resend { background: none; border: 0; padding: 6px 2px; font-size: 13px; font-weight: 600; color: var(--sms-primary); }
.mfa-resend:disabled { color: var(--sms-text-disabled); cursor: not-allowed; }
.mfa-send-count { margin: 0; text-align: center; color: var(--sms-text-muted); font-size: 11px; }
.mfa-restart { display: block; margin: 20px auto 0; border: 0; background: none; color: var(--sms-text-muted); font-size: 12px; padding: 8px; text-decoration: underline; text-underline-offset: 3px; }
.mfa-area button:focus-visible { outline: 3px solid rgba(var(--sms-primary-rgb), .3); outline-offset: 3px; }
.login-form input:disabled { background: var(--sms-bg-app); color: var(--sms-text-muted); }
@media (max-width: 480px) {
    .login-panel.mfa-active { padding: 24px 20px; }
    .mfa-steps { gap: 20px; }
    .mfa-code-heading { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) { .mfa-area * { transition: none !important; } }
```

## 2. login.js: ApiClient를 유지하고 LDAP 성공 분기만 변경

기존 `DOMContentLoaded` 안에서 loginForm을 찾은 직후:

```javascript
const mfa = SmsLoginMfa.init(loginForm);
let loginBusy = false;
```

기존 submit 리스너 시작에 추가:

```javascript
e.preventDefault();
if (loginBusy || mfa.isActive()) return;
loginBusy = true;
```

기존 LDAP API 호출과 성공 판정은 그대로 둔다. 성공 분기의 **기존 `loginForm.submit()` 한 줄**을 다음으로 교체한다.

```javascript
await mfa.begin();
```

기존 try/catch 뒤 finally에서 `loginBusy = false`로 해제한다.
LDAP API의 기존 `ApiClient.post()` 반환값에서 어떤 필드가 성공인지는 기존 업무 계약을 그대로 사용한다.
MFA 성공 처리는 아래 모듈 안에서 `status === 'VERIFIED'`일 때만 native submit을 호출한다.
최종 Spring Security 실패는 기존 failureUrl로 이동하며 JS catch로 돌아오지 않는다.

신규 JS 전체:

```javascript
/** MFA UI 적용 예제. 스케폴드 ApiClient(Axios/CSRF/ApiResponse 언래핑)를 그대로 사용한다. */
(function () {
    'use strict';
    window.SmsLoginMfa = {
        init(loginForm) {
            const el = id => document.getElementById(id);
            const area = el('mfaArea');
            const input = el('mfaCode');
            const verify = el('mfaVerifyButton');
            const resend = el('mfaResendButton');
            const restart = el('mfaRestartButton');
            const loginUrl = new URL(loginForm.action, window.location.href);
            const endpoint = action => loginUrl.pathname.replace(/\/$/, '') + '/mfa/' + action;
            let active = false;
            let busy = false;
            let completed = false;
            let restartRequired = false;
            let state = null;
            let clockOffset = 0;
            let ticker;
            let expiryAnnounced = false;

            const now = () => Date.now() + clockOffset;
            const secondsUntil = time => Math.max(0, Math.ceil((time - now()) / 1000));
            const mmss = seconds => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');

            function message(text, kind = '') {
                el('mfaMessage').textContent = text;
                el('mfaMessage').className = 'mfa-message' + (kind ? ' is-' + kind : '');
                const invalid = kind === 'error';
                input.setAttribute('aria-invalid', String(invalid));
                el('mfaCodeControl').classList.toggle('is-invalid', invalid);
            }

            function render() {
                const left = state ? secondsUntil(state.challengeExpiresAtMs) : 0;
                const pending = state ? secondsUntil(state.pendingExpiresAtMs) : 0;
                const wait = state ? secondsUntil(state.resendAvailableAtMs) : 0;
                if (state && pending === 0 && !completed && !restartRequired) {
                    restartRequired = true;
                    message('로그인 인증 시간이 만료되었습니다. 계정 인증부터 다시 진행해 주세요.', 'error');
                }
                if (state && state.challengeExpiresAtMs > 0 && left === 0 && !expiryAnnounced && !busy && !completed && !restartRequired) {
                    expiryAnnounced = true;
                    message('인증 시간이 만료되었습니다. 인증번호를 다시 요청해 주세요.', 'error');
                }
                el('mfaTimer').textContent = state ? mmss(left) : '--:--';
                el('mfaTimer').classList.toggle('is-urgent', Boolean(state) && left <= 60);
                el('mfaAttempts').textContent = state ? '검증 기회 ' + state.attemptsRemaining + '회 남음' : '확인 중';
                el('mfaSendCount').textContent = state ? '추가 발송 가능 ' + state.sendsRemaining + '회' : '';
                input.disabled = busy || completed || restartRequired || !state || left === 0;
                verify.disabled = input.disabled || !/^\d{6}$/.test(input.value) || state.attemptsRemaining <= 0;
                verify.textContent = completed ? '인증 완료 · 로그인 중' : busy ? '처리 중…' : '인증하고 로그인';
                resend.disabled = busy || completed || restartRequired || (state && (wait > 0 || state.sendsRemaining <= 0));
                resend.textContent = wait > 0 ? '재전송 (' + mmss(wait) + ')' : '재전송';
                restart.disabled = busy || completed;
                area.setAttribute('aria-busy', String(busy));
            }

            function apply(result) {
                // ApiClient는 axios response가 아니라 ApiResponse.data를 반환한다.
                const fields = ['serverNowMs', 'pendingExpiresAtMs', 'challengeExpiresAtMs',
                    'resendAvailableAtMs', 'attemptsRemaining', 'sendsRemaining'];
                if (!result || !fields.every(key => Number.isFinite(result[key]))) {
                    throw new Error('인증 서버 응답을 확인할 수 없습니다. 계정 인증부터 다시 진행해 주세요.');
                }
                clockOffset = result.serverNowMs - Date.now();
                state = result;
                restartRequired = result.status === 'RESTART_REQUIRED';
                if (result.status === 'SENT') {
                    input.value = '';
                    expiryAnnounced = false;
                    message(result.message, 'success');
                } else if (result.status === 'VERIFIED') {
                    completed = true;
                    input.value = '';
                    message('본인 인증이 완료되었습니다.', 'success');
                } else {
                    message(result.message, 'error');
                    if (result.status === 'INVALID_CODE') input.select();
                }
                render();
            }

            async function post(action, body = {}) {
                let timer;
                try {
                    // 공통 인터셉터의 비JSON 응답 처리로 체인이 멈추어도 UI의 대기는 끝낸다.
                    // 서버 계약은 반드시 JSON이며 공통 http-client.js 자체는 변경하지 않는다.
                    return await Promise.race([
                        ApiClient.post(endpoint(action), body, { timeout: 12000 }),
                        new Promise((_, reject) => {
                            timer = setTimeout(() => reject(new Error('응답 시간이 초과되었습니다. 다시 시도해 주세요.')), 13000);
                        })
                    ]);
                } finally { clearTimeout(timer); }
            }

            async function run(work) {
                if (busy || completed) return;
                busy = true;
                render();
                try { await work(); }
                catch (error) {
                    message(error.response?.data?.message || error.message || '인증 서버 연결에 실패했습니다.', 'error');
                    if (error.response?.status === 401 || error.response?.status === 403) restartRequired = true;
                } finally {
                    busy = false;
                    render();
                    if (!input.disabled) input.focus();
                }
            }

            async function begin() {
                if (active) return;
                active = true;
                area.hidden = false;
                loginForm.closest('.login-panel')?.classList.add('mfa-active');
                loginForm.querySelector('[data-login-credentials]')?.setAttribute('hidden', '');
                el('loginButton').hidden = true;
                el('empId').readOnly = true;
                if (el('password')) el('password').readOnly = true;
                el('mfaEmpId').textContent = el('empId').value.trim();
                message('인증번호 발송을 요청하고 있습니다.');
                ticker = setInterval(render, 250);
                await run(async () => apply(await post('send')));
            }

            verify.addEventListener('click', () => {
                if (verify.disabled) return;
                run(async () => {
                    apply(await post('verify', { code: input.value.trim() }));
                    if (completed) {
                        clearInterval(ticker);
                        loginForm.submit(); // 최종 Spring Security /login 제출 위치는 이곳 하나.
                    }
                });
            });
            resend.addEventListener('click', () => {
                if (resend.disabled) return;
                run(async () => apply(await post('send')));
            });
            restart.addEventListener('click', () => run(async () => {
                await post('cancel');
                window.location.assign(loginUrl.pathname);
            }));
            input.addEventListener('input', () => {
                input.value = input.value.replace(/\D/g, '').slice(0, 6);
                input.setAttribute('aria-invalid', 'false');
                el('mfaCodeControl').classList.remove('is-invalid');
                render();
            });
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') { event.preventDefault(); verify.click(); }
            });
            document.addEventListener('visibilitychange', render);
            window.addEventListener('pagehide', () => clearInterval(ticker));
            window.addEventListener('pageshow', event => {
                if (event.persisted && active && !completed) {
                    clearInterval(ticker);
                    ticker = setInterval(render, 250);
                    render();
                }
            });
            render();
            return { begin, isActive: () => active };
        }
    };
})();
```

`ApiClient.post(url, body, {timeout:12000})`의 세 번째 인자는 실제 공통 래퍼가 지원하는 Axios config다.
CSRF 헤더나 응답 언래핑을 여기서 중복 구현하지 않는다.
현재 공통 인터셉터는 로그인 HTML 응답에서 Promise 체인을 멈추므로, MFA API는 반드시 JSON을 반환하도록 연결한다.
UI에 전체 대기 제한시간도 두어 잘못된 HTML 응답이 와도 계속 처리 중인 상태로 남지 않게 한다.

## 3. 신규 MfaLoginState.java: 서버 세션 상태

```java
package com.scbk.sms.auth;

import java.io.Serializable;
import java.time.Instant;

// 1차 인증 대기시간과 인증번호 만료시간은 별도 관리한다.
public final class MfaLoginState implements Serializable {
    private static final long serialVersionUID = 1L;
    public static final String KEY = "SMS_MFA_LOGIN_STATE";
    public final String empId;
    public final Instant expiresAt = Instant.now().plusSeconds(600);
    public Instant challengeExpiresAt = Instant.EPOCH;
    public Instant lastSendAt = Instant.EPOCH;
    public String sequence;
    public int sends;
    public int failures;
    public boolean verified;
    public boolean consumed;

    public MfaLoginState(String empId) { this.empId = empId; }
    public boolean active() { return !consumed && Instant.now().isBefore(expiresAt); }
}
```

예제 정책은 **LDAP 대기 10분 / 인증번호 최대 5분 / 검증 실패 총 5회 / 재발송 간격 30초 / 발송 총 3회**다.
재전송은 새 번호의 만료시각을 계산하되 LDAP 대기 만료시각을 넘기지 않는다. 검증 실패 횟수는 재전송해도 초기화하지 않는다.
MFA 데몬 전문에는 만료시각이 없으므로 `sms.mfa.code-ttl-seconds`를 데몬의 `auth.ttl-minutes × 60`과 일치시켜야 한다.
SMS에서 요청 시작시각 기준으로 보수적으로 계산하고, 데몬의 C/D 검증도 통과해야 최종 성공이다. UI 카운트다운은 인증 근거가 아니다.
기존 JSP는 180초를 표시하지만 기존 데몬의 실제 발급 만료는 5분이다. 이 추가분은 서버와 동일한 300초를 사용한다.
5회 검증 제한·3회 발송 제한·30초 재전송 대기는 기존 JSP에서 확인된 정책이 아니라 이번 적용안의 정책이다.
이 예제의 synchronized 보호는 단일 SMS JVM 또는 sticky session을 전제로 한다.
세션을 여러 JVM에서 동시에 변경하는 구성이라면 원자적 세션 저장소 처리가 별도로 필요하다.

## 4. 기존 LDAP 인증 처리: 실제 성공한 곳에 삽입

메서드 시작 시 이전 대기 상태를 제거한다. 이후 기존 LDAP 인증과 SMS 사용자/권한 검증을 수행한다.
`request`는 HttpServletRequest이며 기존 DTO 변수와 이름이 겹치면 `httpRequest` 등으로 바꾼다.

```java
// 기존 LDAP 로그인 메서드의 시작 부분
var previous = request.getSession(false);
if (previous != null) previous.removeAttribute(MfaLoginState.KEY);

// ... 기존 LDAP 인증 및 SMS 로그인 가능 사용자 검증 ...

// 두 검증이 모두 성공한 분기에만 추가한다.
// authenticatedEmpId는 LDAP/사용자 조회로 확정한 ID이며 클라이언트 값의 무검증 복사가 아니다.
var session = request.getSession(true);
request.changeSessionId(); // 1차 인증 시 세션 ID 갱신; CSRF 세션 값은 유지된다.
session.setAttribute(MfaLoginState.KEY, new MfaLoginState(authenticatedEmpId));

// 기존 성공 응답은 유지. 여기서 SecurityContext에 최종 Authentication을 저장하지 않는다.
```

필요 import: `com.scbk.sms.auth.MfaLoginState`, `jakarta.servlet.http.HttpServletRequest`.
LDAP ID가 MFA 전문의 숫자 행번(최대 6자리)과 다르면 **서버의 검증된 사용자 정보로 매핑**해야 한다.
세션의 empId는 최종 `/login`의 empId와 일치해야 하며, 별도 MFA 행번이 필요하면 상태 클래스에 별도 필드를 추가한다.

## 5. 신규 MfaTcpClient.java: 실제 데몬 전문 연동 예제

이 코드는 106바이트 계약을 사용한다. 발급 응답에 포함된 인증번호는 브라우저나 로그로 내보내지 않는다.
JSP와 같이 A/C 모두 `SMSADMIN` 채널과 서버에서 확인한 행번을 넣는다.
송신 후 `flush()`와 `shutdownOutput()`으로 요청 EOF를 보내야 LF/EOF를 기다리는 기존 데몬에도 연결할 수 있다.
`shutdownOutput()`은 송신만 종료하므로 응답은 계속 읽을 수 있다. NEW_MFA 데몬도 이 방식으로 처리한다.
소켓 문자셋은 EUC-KR로 명시했다. 기존 JSP의 페이지 선언과 달리 실제 소켓 코드는 JVM 기본 문자셋을 사용하므로,
운영 JVM 문자셋과 비ASCII 응답 호환성은 실제 환경에서 확인한다.

```java
package com.scbk.sms.auth;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class MfaTcpClient {
    private final String host;
    private final int port;
    private final String channel;
    private final int timeout;
    private final Charset charset = Charset.forName("EUC-KR");

    public MfaTcpClient(@Value("${sms.mfa.host}") String host,
                        @Value("${sms.mfa.port}") int port,
                        @Value("${sms.mfa.channel:SMSADMIN}") String channel,
                        @Value("${sms.mfa.timeout-ms:5000}") int timeout) {
        if (host.isBlank() || port < 1 || port > 65535 || timeout < 100 || timeout > 30000) {
            throw new IllegalArgumentException("MFA 연결 설정 오류");
        }
        this.host = host;
        this.port = port;
        this.channel = channel;
        this.timeout = timeout;
    }

    public String issue(String empId) throws IOException {
        if (!empId.matches("\\d{1,6}")) throw new IOException("MFA 행번 형식 오류");
        byte[] frame = blank('A');
        put(frame, 44, 10, channel);
        put(frame, 54, 6, empId);
        byte[] reply = exchange(frame, 'B');
        try {
            if (!code(reply).equals("200")) throw new IOException("MFA 발송 요청 실패");
            String seq = new String(reply, 60, 20, charset).trim();
            if (seq.isEmpty()) throw new IOException("MFA 시퀀스 누락");
            return seq; // OTP 필드(80~85)는 읽어 반환하지 않는다.
        } finally { Arrays.fill(reply, (byte) 0); }
    }

    public boolean verify(String empId, String sequence, String otp) throws IOException {
        if (!empId.matches("\\d{1,6}")) throw new IOException("MFA 행번 형식 오류");
        byte[] frame = blank('C');
        // JSP의 C 전문과 동일한 필드 구성. ID와 시퀀스는 브라우저가 아닌 서버 세션에서 가져온다.
        put(frame, 44, 10, channel);
        put(frame, 54, 6, empId);
        put(frame, 60, 20, sequence);
        put(frame, 80, 6, otp);
        byte[] reply = exchange(frame, 'D');
        String result = code(reply);
        if (result.equals("200")) return true;
        if (result.equals("401")) return false;
        throw new IOException("MFA 검증 요청 실패");
    }

    private byte[] exchange(byte[] frame, char expectedType) throws IOException {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeout);
            socket.getOutputStream().write(frame);
            socket.getOutputStream().flush();
            // 기존 데몬은 LF/EOF까지 읽는다. 응답을 기다리기 전에 송신 완료를 알린다.
            socket.shutdownOutput();
            byte[] reply = new byte[106];
            int offset = 0;
            long deadline = System.nanoTime() + timeout * 1_000_000L;
            while (offset < reply.length) {
                long remaining = deadline - System.nanoTime();
                if (remaining <= 0) throw new java.net.SocketTimeoutException();
                socket.setSoTimeout((int) Math.max(1, remaining / 1_000_000L));
                int n = socket.getInputStream().read(reply, offset, reply.length - offset);
                if (n < 0) throw new IOException("MFA 응답 길이 오류");
                offset += n;
            }
            if (reply[0] != (byte) expectedType) throw new IOException("MFA 응답 유형 오류");
            return reply;
        } finally { Arrays.fill(frame, (byte) 0); }
    }

    private byte[] blank(char type) {
        byte[] result = new byte[106];
        Arrays.fill(result, (byte) ' ');
        result[0] = (byte) type;
        return result;
    }

    private void put(byte[] frame, int offset, int width, String text) throws IOException {
        ByteBuffer encoded = charset.newEncoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .encode(CharBuffer.wrap(text));
        if (encoded.remaining() > width) throw new IOException("MFA 필드 길이 오류");
        encoded.get(frame, offset, encoded.remaining());
    }

    private String code(byte[] reply) {
        return new String(reply, 1, 3, StandardCharsets.US_ASCII);
    }
}
```

## 6. 기존 Controller에 발송·검증 메서드 추가

아래는 메서드를 담는 모양을 설명하기 위한 클래스 예제다. **별도 Controller를 반드시 만들라는 뜻이 아니다.**
기존 Controller에 생성자 주입과 메서드/record만 합친다. 이미 class-level `@RequestMapping("/ad")`가 있다면
아래 경로에도 `/ad`가 붙으므로 JS와 SecurityConfig 경로를 동일하게 조정하거나, prefix 없는 기존 LoginController에 넣는다.
응답은 스케폴드의 `ApiResponse.success(MfaView)`를 사용한다. 현재 ApiResponse 패키지는 `com.scbk.sms.dto.common`이다.
번호 불일치·만료·재발송 대기는 MFA 절차의 결과 상태이므로 `data.status`로 전달해 입력 영역에 표시한다.
바깥 `code=200`은 요청 결과를 전달했다는 뜻이며 **인증 성공은 `data.status=VERIFIED`만** 의미한다.
권한/CSRF/처리 불가능한 서버 예외는 기존 HTTP 오류 처리와 공통 알림 정책을 유지한다.
새 API를 전역 응답 어드바이스가 다시 감싸는 폐쇄망 버전이라면 wrapper가 한 번만 적용되게 맞춘다.

```java
package com.scbk.sms.auth;

import com.scbk.sms.dto.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class MfaEndpointExample {
    private final MfaTcpClient client;
    private final int codeTtlSeconds;

    public MfaEndpointExample(MfaTcpClient client,
            @Value("${sms.mfa.code-ttl-seconds:300}") int codeTtlSeconds) {
        if (codeTtlSeconds < 1 || codeTtlSeconds > 3600)
            throw new IllegalArgumentException("MFA 유효시간 설정 오류");
        this.client = client;
        this.codeTtlSeconds = codeTtlSeconds;
    }

    public record VerifyRequest(String code) {}
    public record MfaView(String status, String message, long serverNowMs,
            long pendingExpiresAtMs, long challengeExpiresAtMs, long resendAvailableAtMs,
            int attemptsRemaining, int sendsRemaining) {}

    @PostMapping("/login/mfa/send")
    public ResponseEntity<ApiResponse<MfaView>> send(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        MfaLoginState state = state(session);
        if (state == null) return reply(null, "RESTART_REQUIRED", "계정 인증부터 다시 진행해 주세요.");
        synchronized (state) {
            if (!current(session, state)) return reply(state, "RESTART_REQUIRED", "로그인 인증 시간이 만료되었습니다.");
            if (state.verified) return reply(state, "RESTART_REQUIRED", "완료된 인증입니다. 다시 로그인해 주세요.");
            if (state.sends >= 3) return reply(state, "SEND_LIMIT", "발송 횟수를 모두 사용했습니다.");
            Instant issuedAt = Instant.now();
            if (issuedAt.isBefore(state.lastSendAt.plusSeconds(30)))
                return reply(state, "RETRY_LATER", "재전송 대기시간 이후에 다시 요청해 주세요.");
            state.sends++;
            state.lastSendAt = issuedAt;
            state.sequence = null;
            state.challengeExpiresAt = Instant.EPOCH;
            try {
                state.sequence = client.issue(state.empId);
                // 데몬 응답에는 만료시각이 없어 요청 시작시각+동일 TTL로 보수적으로 계산한다.
                Instant codeExpiry = issuedAt.plusSeconds(codeTtlSeconds).truncatedTo(ChronoUnit.SECONDS);
                state.challengeExpiresAt = codeExpiry.isBefore(state.expiresAt) ? codeExpiry : state.expiresAt;
                if (!current(session, state)) return reply(state, "RESTART_REQUIRED", "로그인 인증 시간이 만료되었습니다.");
                return reply(state, "SENT", "인증번호 발송을 요청했습니다. 수신한 번호를 입력해 주세요.");
            } catch (IOException e) {
                return reply(state, "UNAVAILABLE", "발송 요청에 실패했습니다. 잠시 후 재전송해 주세요.");
            }
        }
    }

    @PostMapping("/login/mfa/verify")
    public ResponseEntity<ApiResponse<MfaView>> verify(@RequestBody VerifyRequest body,
            HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        MfaLoginState state = state(session);
        if (state == null) return reply(null, "RESTART_REQUIRED", "계정 인증부터 다시 진행해 주세요.");
        synchronized (state) {
            if (!current(session, state)) return reply(state, "RESTART_REQUIRED", "로그인 인증 시간이 만료되었습니다.");
            if (state.verified) return reply(state, "VERIFIED", "본인 인증이 완료되었습니다.");
            if (state.sequence == null) return reply(state, "NOT_SENT", "인증번호를 먼저 요청해 주세요.");
            if (!Instant.now().isBefore(state.challengeExpiresAt)) {
                state.sequence = null;
                return reply(state, "EXPIRED", "인증 시간이 만료되었습니다. 인증번호를 다시 요청해 주세요.");
            }
            if (body.code() == null || !body.code().matches("\\d{6}"))
                return reply(state, "INVALID_FORMAT", "인증번호 6자리를 입력해 주세요.");
            try {
                boolean verified = client.verify(state.empId, state.sequence, body.code());
                if (!current(session, state)) return reply(state, "RESTART_REQUIRED", "로그인 인증 시간이 만료되었습니다.");
                if (verified) {
                    state.verified = true;
                    return reply(state, "VERIFIED", "본인 인증이 완료되었습니다.");
                }
                if (++state.failures >= 5) {
                    state.consumed = true;
                    session.removeAttribute(MfaLoginState.KEY);
                    return reply(state, "RESTART_REQUIRED", "검증 횟수를 초과했습니다. 계정 인증부터 다시 진행해 주세요.");
                }
                return reply(state, "INVALID_CODE", "인증번호가 다르거나 만료되었습니다. 다시 확인해 주세요.");
            } catch (IOException e) {
                return reply(state, "UNAVAILABLE", "인증 서버 연결에 실패했습니다. 다시 시도해 주세요.");
            }
        }
    }

    @PostMapping("/login/mfa/cancel")
    public ResponseEntity<ApiResponse<MfaView>> cancel(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        MfaLoginState state = state(session);
        if (state != null) synchronized (state) {
            if (session.getAttribute(MfaLoginState.KEY) == state) {
                state.consumed = true;
                session.removeAttribute(MfaLoginState.KEY);
            }
        }
        return reply(null, "CANCELLED", "인증을 초기화했습니다.");
    }

    private MfaLoginState state(HttpSession session) {
        return session == null ? null : (MfaLoginState) session.getAttribute(MfaLoginState.KEY);
    }
    private boolean current(HttpSession session, MfaLoginState state) {
        return session.getAttribute(MfaLoginState.KEY) == state && state.active();
    }
    private ResponseEntity<ApiResponse<MfaView>> reply(MfaLoginState state, String status, String message) {
        MfaView view = new MfaView(status, message, Instant.now().toEpochMilli(),
            state == null ? 0 : state.expiresAt.toEpochMilli(),
            state == null ? 0 : state.challengeExpiresAt.toEpochMilli(),
            state == null ? 0 : state.lastSendAt.plusSeconds(30).toEpochMilli(),
            state == null ? 0 : Math.max(0, 5 - state.failures),
            state == null ? 0 : Math.max(0, 3 - state.sends));
        return ResponseEntity.ok(ApiResponse.success(view));
    }
}
```

검증 응답이 유실된 경우 데몬에서 이미 번호를 소비했을 수 있다. 무조건 성공으로 바꾸지 않고 재발송/재인증하게 한다.
발급 응답 성공은 SMS 큐 등록 성공이며 단말 문자 도착 보장은 아니다.

## 7. 신규 MfaLoginGateFilter.java: 최종 POST /login 우회 방지

아래 필터에는 `@Component`를 붙이지 않는다. Spring Security 체인에 한 번만 등록한다.

```java
package com.scbk.sms.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

public final class MfaLoginGateFilter extends OncePerRequestFilter {
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equalsIgnoreCase(request.getMethod())
            || !(request.getContextPath() + "/login").equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        var session = request.getSession(false);
        var state = session == null ? null : (MfaLoginState) session.getAttribute(MfaLoginState.KEY);
        String submittedId = request.getParameter("empId");
        boolean allowed = false;
        if (state != null) {
            synchronized (state) {
                allowed = session.getAttribute(MfaLoginState.KEY) == state
                    && state.active() && state.verified && submittedId != null
                    && state.empId.equals(submittedId.trim());
                if (allowed) {
                    state.consumed = true;
                    session.removeAttribute(MfaLoginState.KEY); // 동일 완료 상태로 재로그인 금지.
                }
            }
        }
        if (!allowed) {
            response.sendRedirect(response.encodeRedirectURL(request.getContextPath() + "/login?error"));
            return;
        }
        chain.doFilter(request, response); // 기존 Spring Security 로그인/세션 정책 계속 적용.
    }
}
```

MFA 완료 후 최종 Spring Security 인증이 실패하면 대기 상태가 이미 소진되므로 1차 인증부터 다시 시작한다.
ID 변경 요청을 먼저 보내더라도 성공한 다른 요청과 동일한 완료 상태를 동시에 사용할 수 없다.

## 8. SecurityConfig: 기존 web 체인에 두 줄기만 추가

기존 `/login` 처리, username/password parameter, 성공·실패 URL 및 API 전용 체인을 유지한다.
새 `/login/mfa/*` API는 최종 로그인 전 호출되므로 permitAll이 필요하며, 메서드 내부가 LDAP 대기 세션을 검사한다.
CSRF는 기존처럼 활성화한다.

```java
// 기존 web authorizeHttpRequests에서 anyRequest()보다 앞에 추가
.requestMatchers("/login/mfa/send", "/login/mfa/verify", "/login/mfa/cancel").permitAll()

// 기존 webSecurityFilterChain의 http 설정에 추가 (return http.build() 이전)
http.addFilterBefore(new MfaLoginGateFilter(), UsernamePasswordAuthenticationFilter.class);
```

필요 import:

```java
import com.scbk.sms.auth.MfaLoginGateFilter;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
```

현재 `/login`이 `UsernamePasswordAuthenticationFilter`가 아닌 커스텀 필터에서 처리된다면 실제 로그인 필터보다 먼저 배치한다.
공통 인터셉터가 비로그인 MFA API를 메뉴 권한으로 막는 경우 send/verify/cancel 세 경로만 기존 로그인 예외 목록에 추가한다.
처음부터 모든 메뉴/예외 처리 파일을 수정하지 말고 실제 차단 경로만 확인한다.

## 9. 기존 환경 설정에 추가

```properties
sms.mfa.host=${MFA_HOST}
sms.mfa.port=${MFA_PORT}
sms.mfa.channel=SMSADMIN
sms.mfa.timeout-ms=5000
# 데몬 auth.ttl-minutes=5와 같은 값으로 설정
sms.mfa.code-ttl-seconds=300
```

OTP를 고정해서 운영 인증을 우회하는 local 분기는 만들지 않는다.
로컬 화면 확인이 필요하면 별도 테스트 fixture에서 LDAP/MFA 성공·실패를 재현한다.


## 10. 실제 수정본에 적용한 뒤 확인할 부분

- LDAP 성공 조건을 변경하지 않았으며 LDAP 실패 시 발급하지 않는지.
- Axios → 공통 CSRF/응답 언래핑 → MFA payload 흐름인지.
- 6자리 입력, 서버 기한 기준 카운트다운, 재전송 대기·횟수, 만료·오류 상태가 맞는지.
- MFA 전 POST /login 직접 호출과 메인 URL 접근이 차단되는지.
- 같은 ID의 LDAP/MFA 완료 상태를 서버에서 확인하고 재사용하지 못하는지.
- 최종 Spring Security 성공/실패 경로가 기존과 같은지.
- 비밀번호·OTP·원문 TCP 응답이 로그/화면 응답에 노출되지 않는지.
- A/C 요청의 SMSADMIN·행번·시퀀스·OTP 위치와 송신 EOF, B/D 유형·결과코드 판단이 실제 데몬에서도 일치하는지.
- 기존 JSP의 D200 이후 로그인 시각·실패 횟수·감사 로그 처리는 실제 SMS의 최종 Security 성공 처리에 이미 있는지 확인하고, 누락된 처리만 그 위치에 병합한다. MFA 검증 API에서 로그인 완료 처리를 중복하지 않는다.

## 검증 상태

UI와 Java 예제의 이전 문법/모의 응답 검증은 참고 기록이다.
JSP 소스의 발급·검증 계약 분석은 완료했다. NEW_MFA의 JUnit 성공이 실제 JSP/WAS 실행이나 SMS 로그인 통합 완료를 의미하지는 않는다.
이번에는 SMS 원본 파일을 수정하거나 브라우저 실로그인 테스트를 수행하지 않았다.
