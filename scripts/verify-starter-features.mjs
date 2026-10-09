import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const stage = process.env.SC_EVIDENCE_STAGE ?? "005";
assert.match(stage, /^[0-9]{3}$/, "SC_EVIDENCE_STAGE는 세 자리 단계 번호여야 합니다.");
const taskDirectory = await mkdtemp(join(tmpdir(), "sc-starter-features-"));
const output = join(taskDirectory, "dist");
let browser;
let server;
try {
  const build = spawn(
    process.execPath,
    [resolve(root, "node_modules/vite/bin/vite.js"), "build", "--outDir", output, "--emptyOutDir"],
    {
      cwd: resolve(root, "frontend/apps/starter-app"),
      env: { ...process.env, VITE_SC_PATTERNS_ENABLED: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let buildLog = "";
  build.stdout.on("data", (chunk) => {
    buildLog += chunk;
  });
  build.stderr.on("data", (chunk) => {
    buildLog += chunk;
  });
  const exitCode = await new Promise((done, reject) => {
    build.once("error", reject);
    build.once("exit", done);
  });
  await writeFile(resolve(root, `docs/검증/${stage}-starter-features-build.log`), buildLog);
  assert.equal(exitCode, 0, "선택 모듈을 제외한 Starter 빌드 실패");
  const assets = await readdir(join(output, "assets"));
  // 활성 설정은 런타임 소비를 제어한다. 번들 파일 제거까지 보장하지 않는다.
  const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
  };
  const apiRequests = [];
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (pathname.startsWith("/api/")) {
        apiRequests.push(pathname);
        response.writeHead(404);
        response.end();
        return;
      }
      const file = extname(pathname) ? resolve(output, "." + pathname) : join(output, "index.html");
      assert.equal(relative(output, file).startsWith(".."), false);
      response.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
      response.end(await readFile(file));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const browserErrors = [];
  const optionalChunkRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/PatternsPage-"))
      optionalChunkRequests.push(request.url());
  });
  page.on("pageerror", (error) => browserErrors.push(error.name));
  // 서버 없는 UI 설정 검사다. 건강 조회만 합성하며 인증/업무 요청을 흉내 내지 않는다.
  await page.route("**/api/health", (route) => route.fulfill({ json: { status: "UP" } }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin + "/patterns");
  await expect(page).toHaveURL(origin + "/");
  await expect(page.getByLabel("프로젝트 제목", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("UP");
  await expect(page.getByRole("link", { name: "공통 기능 예제", exact: true })).toHaveCount(0);
  await page.getByLabel("프로젝트 제목", { exact: true }).fill("모듈 없는 Starter");
  await expect(page.getByLabel("프로젝트 제목", { exact: true })).toHaveValue("모듈 없는 Starter");
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(optionalChunkRequests, []);
  assert.deepEqual(apiRequests, []);
  const result = {
    patternsEnabled: false,
    isolatedBuild: true,
    defaultBuildUnchanged: true,
    assets,
    optionalChunkRequests,
    optionalChunksEmitted: assets.filter((name) => name.startsWith("PatternsPage-")),
    unknownRouteRedirect: "/",
    browserErrors,
    apiRequests,
  };
  await writeFile(
    resolve(root, `docs/검증/${stage}-starter-features.json`),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log("Starter 선택 모듈 제외: 빌드/메뉴/경로/기본 입력/건강 조회 통과");
} finally {
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
  await rm(taskDirectory, { recursive: true, force: true });
}
