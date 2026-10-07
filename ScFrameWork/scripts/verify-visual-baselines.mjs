// PNG·환경·완료 케이스를 함께 검증한다. 기본 실행에서는 기준 파일을 바꾸지 않는다.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("..", import.meta.url));
const applications = ["reference", "starter"];
const widths = [1366, 390];
const captures = ["shell-inputs", "table", "chart", "editor"];
const safeName = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const arguments_ = process.argv.slice(2);
const options = { profile: `${process.platform}-chromium`, record: false, runId: undefined };
const fail = (message) => {
  throw new Error(message);
};

for (let index = 0; index < arguments_.length; index++) {
  const argument = arguments_[index];
  if (argument === "--help") {
    console.log(
      "사용법: node scripts/verify-visual-baselines.mjs --profile <프로필> [--record --run-id <완료한 갱신 실행 ID>]",
    );
    process.exit(0);
  } else if (argument === "--record") options.record = true;
  else if (argument === "--profile" || argument === "--run-id") {
    const value = arguments_[++index];
    if (!value || !safeName.test(value)) fail(`${argument}: 안전한 이름을 지정해야 합니다.`);
    if (argument === "--profile") options.profile = value;
    else options.runId = value;
  } else fail(`지원하지 않는 옵션: ${argument}`);
}

function same(left, right) {
  // object key 순서가 달라도 값·배열 순서가 같으면 같은 계약이다.
  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonical(value[key])]),
      );
    return value;
  };
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

async function readJson(filename) {
  return JSON.parse(await fs.readFile(filename, "utf8"));
}

function validateEnvironment(environment) {
  if (!environment || environment.profile !== options.profile)
    fail("환경 프로필이 일치하지 않습니다.");
  if (!["darwin", "linux", "win32"].includes(environment.platform))
    fail("지원하는 OS 환경이 아닙니다.");
  if (
    typeof environment.os?.release !== "string" ||
    !environment.os.release ||
    typeof environment.os?.version !== "string" ||
    !environment.os.version
  )
    fail("OS release·version 정보가 누락되었습니다.");
  if (
    environment.browser !== "chromium" ||
    !environment.browserVersion ||
    !environment.playwrightVersion ||
    !environment.architecture
  )
    fail("Chromium·Playwright·CPU 환경 정보가 누락되었습니다.");
  if (
    !same(environment.settings, {
      locale: "ko-KR",
      timezoneId: "UTC",
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
    })
  )
    fail("고정된 locale·UTC·DPR·색상·모션 계약과 다릅니다.");
  const font = environment.font;
  if (
    !font?.family ||
    !font?.size ||
    !font?.weight ||
    !font?.userAgent ||
    font.devicePixelRatio !== 1 ||
    !Number.isFinite(font.latinWidth) ||
    font.latinWidth <= 0 ||
    !Number.isFinite(font.koreanWidth) ||
    font.koreanWidth <= 0
  )
    fail("실제 UI 글꼴과 한글/영문 폭 측정이 누락되었습니다.");
}

function expectedImages(platform) {
  return applications.flatMap((application) =>
    widths.flatMap((width) =>
      captures.map((capture) => ({
        application,
        viewport: { width, height: 844 },
        capture,
        name: `${application}-${width}-${capture}.png`,
        file: `${application}-${width}-${capture}-${platform}.png`,
      })),
    ),
  );
}

async function inspectImages(directory, environment) {
  const expected = expectedImages(environment.platform);
  const actual = (await fs.readdir(directory))
    .filter((filename) => filename.endsWith(".png"))
    .sort();
  if (!same(actual, expected.map((image) => image.file).sort()))
    fail("기준 PNG는 두 앱 × 두 폭 × 네 영역의 정확한 16장이 필요합니다.");
  const images = [];
  for (const image of expected) {
    const bytes = await fs.readFile(path.join(directory, image.file));
    if (
      bytes.length < 33 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.toString("ascii", 12, 16) !== "IHDR"
    )
      fail(`유효한 PNG IHDR이 아닙니다: ${image.file}`);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width <= 0 || height <= 0 || width > 1366 || height > 4096)
      fail(`PNG 크기 계약을 벗어났습니다: ${image.file}`);
    if (
      image.capture === "shell-inputs" &&
      (width !== image.viewport.width || height !== image.viewport.height)
    )
      fail(`전체 viewport 크기가 다릅니다: ${image.file}`);
    images.push({
      ...image,
      width,
      height,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return images;
}

async function record(directory) {
  if (process.env.CI) fail("CI에서는 기준 이미지를 자동 승인하지 않습니다.");
  if (!options.runId) fail("--record에는 완료한 갱신 실행의 --run-id가 필요합니다.");
  const runtime = path.join(repository, ".runtime/visual", options.profile, options.runId);
  let environment;
  for (const application of applications) {
    for (const width of widths) {
      const evidence = await readJson(path.join(runtime, `${application}-${width}.json`));
      validateEnvironment(evidence.environment);
      if (evidence.application !== application || evidence.width !== width)
        fail("완료 케이스 식별자가 다릅니다.");
      if (environment && !same(environment, evidence.environment))
        fail("네 케이스의 실제 실행 환경이 다릅니다.");
      environment = evidence.environment;
      const expected = expectedImages(environment.platform)
        .filter((image) => image.application === application && image.viewport.width === width)
        .map((image) => ({
          name: image.name,
          file: `frontend/e2e/visual.spec.ts-snapshots/${options.profile}/${image.file}`,
        }));
      if (!same(evidence.completed, expected))
        fail("갱신 실행에서 네 영역의 비교가 모두 완료되지 않았습니다.");
    }
  }
  const images = await inspectImages(directory, environment);
  const manifest = {
    schemaVersion: 1,
    environment,
    cases: { applications, widths, height: 844, captures },
    images,
  };
  await fs.writeFile(
    path.join(directory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      result: "recorded",
      profile: options.profile,
      images: images.length,
      runId: options.runId,
    }),
  );
}

async function check(directory) {
  const manifest = await readJson(path.join(directory, "manifest.json"));
  if (manifest.schemaVersion !== 1) fail("지원하지 않는 기준 manifest 버전입니다.");
  validateEnvironment(manifest.environment);
  if (!same(manifest.cases, { applications, widths, height: 844, captures }))
    fail("대표 화면의 케이스 목록이 변경되었습니다.");
  const images = await inspectImages(directory, manifest.environment);
  if (!same(manifest.images, images))
    fail("승인된 PNG의 크기·해시·목록이 변경되었습니다. 이미지 검토 후 명시 갱신해야 합니다.");
  console.log(
    JSON.stringify({
      result: "verified",
      profile: options.profile,
      images: images.length,
      platform: manifest.environment.platform,
      browserVersion: manifest.environment.browserVersion,
    }),
  );
}

try {
  const directory = path.join(repository, "frontend/e2e/visual.spec.ts-snapshots", options.profile);
  if (options.record) await record(directory);
  else await check(directory);
} catch (error) {
  console.error(`시각 기준 검증 실패: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
