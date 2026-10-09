#!/usr/bin/env python3
"""실제 Swagger UI interceptor와 Chromium 쿠키/CSRF를 격리된 JAR에서 검증한다."""
import argparse
import shutil
import subprocess
from _harness import ROOT, JarServer


BROWSER_CHECK = r"""
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const baseURL = process.argv[2];
const secretFile = process.argv[3];
let browser;
let phase = 'bundled Chromium launch';
try {
  const password = (await readFile(secretFile, 'utf8')).trim();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  phase = 'Swagger UI mounted configuration';
  await page.goto(`${baseURL}/swagger-ui/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.ui?.getConfigs?.().requestInterceptor === 'function');
  console.log('PASS mounted Swagger requestInterceptor is a function');

  phase = 'browser login, authenticated me and example save';
  const result = await page.evaluate(async ({ password }) => {
    const interceptor = window.ui.getConfigs().requestInterceptor;
    async function send(path, method, body, contentType) {
      const request = { url: new URL(path, window.location.origin).href, method, headers: {} };
      if (body !== undefined) request.body = body;
      if (contentType) request.headers['Content-Type'] = contentType;
      const prepared = await interceptor(request);
      const response = await fetch(prepared.url, {
        method: prepared.method,
        headers: prepared.headers,
        body: prepared.body,
        credentials: prepared.credentials,
      });
      const json = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
      return { status: response.status, json, csrfAttached: typeof prepared.headers['X-CSRF-TOKEN'] === 'string' };
    }
    const rejected = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'admin', password }).toString(),
    });
    if (rejected.status !== 403) throw new Error('CSRF protection did not reject a tokenless login');
    const login = await send('/api/auth/login', 'POST', new URLSearchParams({ username: 'admin', password }).toString(), 'application/x-www-form-urlencoded');
    if (login.status !== 204 || !login.csrfAttached) throw new Error('Mounted interceptor login failed');
    const me = await send('/api/auth/me', 'GET');
    if (me.status !== 200 || me.json.username !== 'admin' || me.json.role !== 'ADMIN' || !Number.isSafeInteger(me.json.id) || me.json.id <= 0 || typeof me.json.displayName !== 'string' || Object.keys(me.json).sort().join(',') !== 'displayName,id,role,username') throw new Error('Browser session authentication failed');
    const saved = await send('/api/examples', 'POST', JSON.stringify({ title: 'Swagger browser synthetic fixture' }), 'application/json');
    if (saved.status !== 201 || !saved.csrfAttached || saved.json.revision !== 1 || saved.json.title !== 'Swagger browser synthetic fixture') throw new Error('Mounted interceptor save failed after login');
    // 쿠키 값과 토큰은 Node나 검증 기록으로 반환하지 않는다.
    return { tokenlessLogin: 403, login: 204, me: 200, save: 201 };
  }, { password });
  console.log(`PASS tokenless browser login is rejected: HTTP ${result.tokenlessLogin}`);
  console.log(`PASS mounted interceptor form login: HTTP ${result.login}`);
  console.log(`PASS browser cookie authenticated me: HTTP ${result.me}`);
  console.log(`PASS mounted interceptor refreshes CSRF after login and saves example: HTTP ${result.save}`);

  phase = 'HttpOnly browser session cookie';
  const session = (await context.cookies()).find(cookie => cookie.name === 'JSESSIONID');
  if (!session?.httpOnly) throw new Error('Expected an HttpOnly browser session cookie');
  console.log('PASS browser stores an HttpOnly session cookie');

  phase = 'mounted interceptor logout and session invalidation';
  const loggedOut = await page.evaluate(async () => {
    const prepared = await window.ui.getConfigs().requestInterceptor({
      url: new URL('/api/auth/logout', window.location.origin).href, method: 'POST', headers: {},
    });
    const logout = await fetch(prepared.url, { method: prepared.method, headers: prepared.headers, credentials: prepared.credentials });
    return { logout: logout.status, csrfAttached: typeof prepared.headers['X-CSRF-TOKEN'] === 'string' };
  });
  if (loggedOut.logout !== 204 || !loggedOut.csrfAttached) throw new Error('Mounted interceptor logout failed');
  // 먼저 기존 로그인 쿠키 제거를 확인한다. 이후 401의 SavedRequest가 새 익명 세션을 만들 수 있다.
  if ((await context.cookies()).some(cookie => cookie.name === 'JSESSIONID')) throw new Error('Logout did not remove the session cookie');
  const meAfterLogout = await page.evaluate(async () => (await fetch('/api/auth/me', { credentials: 'same-origin' })).status);
  if (meAfterLogout !== 401) throw new Error('Logout did not invalidate authentication');
  console.log('PASS mounted interceptor logout: HTTP 204; me after logout: HTTP 401; cookie removed');
  console.log('7 mounted Swagger browser checks passed. Browser: Playwright bundled Chromium.');
} catch {
  // Playwright 호출 인자·HTTP 본문·쿠키·토큰·계정 값을 오류 로그에 포함하지 않는다.
  console.error(`FAIL ${phase}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar", default=ROOT / "backend/reference-app/target/sc-reference-app.jar")
    parser.add_argument("--node", default=shutil.which("node"))
    parser.add_argument("--log", default=ROOT / "docs/검증/001-swagger-browser.log")
    args = parser.parse_args()
    if not args.node:
        parser.error("Node 24가 PATH에 필요합니다. --node로 실행 파일을 지정할 수 있습니다.")
    server = JarServer(args.jar)
    output = ""
    failed = False
    try:
        server.start()
        result = subprocess.run(
            [args.node, "--input-type=module", "-", server.base_url, str(server.secret)],
            input=BROWSER_CHECK, text=True, cwd=ROOT, capture_output=True, timeout=90,
        )
        output = result.stdout + result.stderr
        failed = result.returncode != 0
    except subprocess.TimeoutExpired:
        # 부분 stdout/stderr에는 런타임의 예외 인자가 있을 수 있어 그대로 저장하지 않는다.
        output = "FAIL Swagger browser validation exceeded its time limit.\n"
        failed = True
    finally:
        server.cleanup()
    log = ROOT / args.log
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(output + "PASS isolated JAR server and synthetic account files cleaned up.\n")
    print(output, end="")
    print("PASS isolated JAR server and synthetic account files cleaned up.")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
