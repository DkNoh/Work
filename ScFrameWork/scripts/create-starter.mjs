#!/usr/bin/env node
// 신규 consumer만 생성한다. 설치/기동/사용자 코드 업그레이드를 자동 실행하지 않는다.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import prettier from "prettier";
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const templateRoot = path.join(repositoryRoot, "templates/starter-v1");
const names = ["@sc/ui", "@sc/runtime", "@sc/date", "@sc/excel", "@sc/i18n"];
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const javaKeywords = new Set(
  "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record sealed permits var yield _".split(
    " ",
  ),
);
export class StarterGeneratorError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "StarterGeneratorError";
  }
}
function reject(code, message) {
  throw new StarterGeneratorError(code, message);
}
function within(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}
async function stat(file) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function relativeFile(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\\") ||
    value.includes("\0") ||
    path.posix.isAbsolute(value) ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  )
    reject("INVALID_FILE_PATH", "상대 파일 경로가 올바르지 않습니다.");
  return value;
}
export function selectTemplateVersion(frameworkVersion) {
  if (["0.1.0", "0.2.0"].includes(frameworkVersion)) return 1;
  if (frameworkVersion === "0.3.0") return 2;
  reject("TEMPLATE_VERSION", "이 배포 버전에 등록된 Starter template이 없습니다.");
}
export function parseArguments(args) {
  const values = {};
  const switches = new Set([
    "--target",
    "--name",
    "--java-package",
    "--frontend-port",
    "--server-port",
    "--artifacts",
  ]);
  if (args.length === 1 && args[0] === "--help") return { help: true };
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--dry-run") {
      if (values.dryRun) reject("INVALID_ARGUMENT", "옵션을 중복 지정하지 마세요.");
      values.dryRun = true;
      continue;
    }
    if (
      !switches.has(key) ||
      values[key] !== undefined ||
      !args[index + 1] ||
      args[index + 1].startsWith("--")
    )
      reject("INVALID_ARGUMENT", "생성 옵션을 확인하세요. --help에서 사용법을 확인할 수 있습니다.");
    values[key] = args[++index];
  }
  for (const key of switches)
    if (values[key] === undefined)
      reject(
        "MISSING_ARGUMENT",
        "새 경로·이름·Java package·두 포트·artifact 경로를 모두 지정하세요.",
      );
  return {
    target: values["--target"],
    name: values["--name"],
    javaPackage: values["--java-package"],
    frontendPort: values["--frontend-port"],
    serverPort: values["--server-port"],
    artifacts: values["--artifacts"],
    dryRun: values.dryRun ?? false,
  };
}
export function validateOptions(input) {
  if (
    typeof input.name !== "string" ||
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(input.name) ||
    input.name.length > 50
  )
    reject("INVALID_NAME", "앱 이름은 소문자로 시작하는 1~50자의 kebab-case를 사용하세요.");
  if (
    typeof input.javaPackage !== "string" ||
    input.javaPackage.length > 150 ||
    !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(input.javaPackage) ||
    input.javaPackage.split(".").some((part) => javaKeywords.has(part))
  )
    reject(
      "INVALID_JAVA_PACKAGE",
      "Java package는 예약어 없이 소문자 2개 이상의 구간으로 지정하세요.",
    );
  const ports = [input.frontendPort, input.serverPort].map((value) => {
    if (!/^[1-9]\d{3,4}$/.test(String(value)) || Number(value) < 1024 || Number(value) > 65535)
      reject("INVALID_PORT", "포트는 1024~65535의 정수로 지정하세요.");
    return Number(value);
  });
  if (ports[0] === ports[1]) reject("PORT_CONFLICT", "프런트와 서버 포트를 다르게 지정하세요.");
  for (const key of ["target", "artifacts"])
    if (typeof input[key] !== "string" || !input[key] || /[\0\r\n]/.test(input[key]))
      reject("INVALID_PATH", "생성/배포 경로를 확인하세요.");
  const target = path.resolve(input.target);
  const protectedRoots = [
    repositoryRoot,
    path.resolve(repositoryRoot, "../WorkboardVue"),
    path.resolve(repositoryRoot, "../workboard"),
  ];
  if (target === path.parse(target).root || protectedRoots.some((root) => within(root, target)))
    reject("PROTECTED_TARGET", "프레임워크/레퍼런스 밖의 새 consumer 경로를 지정하세요.");
  return {
    ...input,
    target,
    artifacts: path.resolve(input.artifacts),
    frontendPort: ports[0],
    serverPort: ports[1],
    dryRun: input.dryRun === true,
  };
}
export async function inspectTarget(target) {
  const protectedStats = (
    await Promise.all(
      [
        repositoryRoot,
        path.resolve(repositoryRoot, "../WorkboardVue"),
        path.resolve(repositoryRoot, "../workboard"),
      ].map(stat),
    )
  ).filter(Boolean);
  let cursor = path.parse(target).root;
  for (const part of target.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    const entry = await stat(cursor);
    if (!entry) continue;
    if (entry.isSymbolicLink())
      reject("SYMLINK_TARGET", "생성 경로와 상위 경로에 symlink를 사용할 수 없습니다.");
    if (
      protectedStats.some(
        (protectedEntry) => entry.ino === protectedEntry.ino && entry.dev === protectedEntry.dev,
      )
    )
      reject("PROTECTED_TARGET", "원본과 프레임워크 디렉터리 안에는 생성하지 않습니다.");
    if (!entry.isDirectory())
      reject("INVALID_TARGET", "생성 경로와 상위 경로는 디렉터리여야 합니다.");
  }
  const existing = await stat(target);
  if (existing && (await fs.readdir(target)).length)
    reject("TARGET_OCCUPIED", "비어 있지 않은 대상은 덮어쓰지 않습니다.");
  return existing;
}
export async function readTemplateBundle(directory = templateRoot) {
  const lockPath = path.join(directory, "template.json");
  const lockStat = await stat(lockPath);
  if (!lockStat || lockStat.isSymbolicLink() || !lockStat.isFile())
    reject("TEMPLATE_INVALID", "템플릿 manifest는 실제 파일이어야 합니다.");
  const lockBytes = await fs.readFile(lockPath);
  let lock;
  try {
    lock = JSON.parse(lockBytes.toString("utf8"));
  } catch {
    reject("TEMPLATE_INVALID", "템플릿 manifest JSON을 확인하세요.");
  }
  if (
    lock.format !== 1 ||
    ![1, 2].includes(lock.templateVersion) ||
    !Array.isArray(lock.files) ||
    !lock.files.length ||
    !Array.isArray(lock.compatibleFrameworkVersions)
  )
    reject("TEMPLATE_INVALID", "템플릿 manifest를 확인하세요.");
  const entries = [];
  const destinations = new Set();
  for (const item of lock.files) {
    const source = relativeFile(item.source);
    const target = relativeFile(item.target);
    if (
      destinations.has(target) ||
      ![0o644, 0o755].includes(item.mode) ||
      !/^[a-f0-9]{64}$/.test(item.sha256 ?? "")
    )
      reject("TEMPLATE_INVALID", "템플릿 allowlist가 올바르지 않습니다.");
    destinations.add(target);
    let cursor = directory;
    for (const part of source.split("/")) {
      cursor = path.join(cursor, part);
      const entry = await stat(cursor);
      if (!entry || entry.isSymbolicLink())
        reject("TEMPLATE_SYMLINK", "템플릿은 실제 allowlist 파일이어야 합니다.");
    }
    const info = await fs.stat(cursor);
    if (!info.isFile() || info.size > 2 * 1024 * 1024)
      reject("TEMPLATE_INVALID", "템플릿 파일 형식을 확인하세요.");
    const bytes = await fs.readFile(cursor);
    if (sha(bytes) !== item.sha256)
      reject(
        "TEMPLATE_HASH_MISMATCH",
        "템플릿이 변경되었습니다. 검토 후 template manifest를 갱신하세요.",
      );
    entries.push({ ...item, bytes });
  }
  return { lock, lockHash: sha(lockBytes), entries };
}
function substitutions(options, manifest) {
  const files = Object.fromEntries(
    manifest.frontend.map((item) => [item.name, path.basename(item.file)]),
  );
  return {
    APP_NAME: options.name,
    JAVA_PACKAGE: options.javaPackage,
    JAVA_PATH: options.javaPackage.replaceAll(".", "/"),
    FRONTEND_PORT: String(options.frontendPort),
    SERVER_PORT: String(options.serverPort),
    BACKEND_VERSION: manifest.backend.version,
    APPLICATION_ID: `sc-${options.name.slice(0, 32)}-${sha(Buffer.from(options.name)).slice(0, 8)}`,
    UI_TARBALL: files["@sc/ui"],
    RUNTIME_TARBALL: files["@sc/runtime"],
    DATE_TARBALL: files["@sc/date"],
    EXCEL_TARBALL: files["@sc/excel"],
    I18N_TARBALL: files["@sc/i18n"],
  };
}
function replaceTokens(value, replacements) {
  return value.replace(/__([A-Z0-9_]+)__/g, (_all, token) => {
    if (["MVNW_CMD", "MVNW_ERROR", "MVNW_ARG0_NAME"].includes(token)) return _all;
    if (!(token in replacements)) reject("TEMPLATE_TOKEN", "지원하지 않는 템플릿 변수가 있습니다.");
    return replacements[token];
  });
}
async function renderBundle(bundle, options, manifest) {
  if (!bundle.lock.compatibleFrameworkVersions.includes(manifest.frameworkVersion))
    reject("TEMPLATE_VERSION", "이 배포 버전은 현재 Starter template과 호환되지 않습니다.");
  const replacements = substitutions(options, manifest);
  const result = [];
  for (const entry of bundle.entries) {
    const target = relativeFile(replaceTokens(entry.target, replacements));
    let text = replaceTokens(entry.bytes.toString("utf8"), replacements);
    // 긴 앱명/파일명도 최종 소비 앱의 같은 Prettier 정책으로 생성한다.
    const info = await prettier.getFileInfo(target);
    if (info.inferredParser)
      text = await prettier.format(text, {
        filepath: target,
        htmlWhitespaceSensitivity: "ignore",
        singleQuote: false,
        printWidth: 100,
      });
    result.push({ file: target, bytes: Buffer.from(text), mode: entry.mode });
  }
  return result;
}
async function readVerifiedArtifact(directory, item) {
  const file = path.join(directory, relativeFile(item.file));
  const bytes = await fs.readFile(file);
  if (sha(bytes) !== item.sha256) reject("ARTIFACT_CHANGED", "검증 뒤 artifact가 변경되었습니다.");
  return bytes;
}
export async function createStarter(input) {
  const options = validateOptions(input);
  const original = await inspectTarget(options.target);
  const { verifyArtifactDirectory } = await import("./verify-package-artifacts.mjs");
  const { manifest } = await verifyArtifactDirectory(options.artifacts);
  const templateVersion = selectTemplateVersion(manifest.frameworkVersion);
  const bundle = await readTemplateBundle(
    path.join(repositoryRoot, `templates/starter-v${templateVersion}`),
  );
  if (
    bundle.lock.templateVersion !== templateVersion ||
    manifest.templateVersion !== bundle.lock.templateVersion ||
    manifest.frontend.length !== 5 ||
    names.some((name) => !manifest.frontend.some((item) => item.name === name))
  )
    reject("ARTIFACT_TEMPLATE", "검증한 배포 세트의 template/패키지 구성이 다릅니다.");
  const rendered = await renderBundle(bundle, options, manifest);
  const vendor = [];
  for (const item of manifest.frontend)
    vendor.push({
      file: `vendor/npm/${path.basename(item.file)}`,
      bytes: await readVerifiedArtifact(options.artifacts, item),
      mode: 0o644,
    });
  for (const item of manifest.backend.files)
    vendor.push({
      file: `vendor/maven/${item.file.replace(/^maven\//, "")}`,
      bytes: await readVerifiedArtifact(options.artifacts, item),
      mode: 0o644,
    });
  const output = [...rendered, ...vendor];
  const provenance = {
    format: 1,
    templateVersion,
    templateManifestSha256: bundle.lockHash,
    frameworkVersion: manifest.frameworkVersion,
    backendVersion: manifest.backend.version,
    app: {
      name: options.name,
      javaPackage: options.javaPackage,
      frontendPort: options.frontendPort,
      serverPort: options.serverPort,
    },
    files: output.map((item) => ({ file: item.file, sha256: sha(item.bytes) })),
    installsExecuted: false,
  };
  output.push({
    file: "sc-starter.lock.json",
    bytes: Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`),
    mode: 0o644,
  });
  const summary = {
    passed: true,
    dryRun: options.dryRun,
    target: options.target,
    templateVersion,
    frameworkVersion: manifest.frameworkVersion,
    templateFiles: rendered.length,
    frontendArtifacts: 5,
    backendArtifacts: manifest.backend.files.length,
    generatedFiles: output.length,
    installsExecuted: false,
  };
  if (options.dryRun) return summary;
  let ancestor = path.dirname(options.target);
  while (!(await stat(ancestor))) ancestor = path.dirname(ancestor);
  const lockFile = path.join(ancestor, `.${path.basename(options.target)}.sc-generator.lock`);
  let handle;
  try {
    handle = await fs.open(lockFile, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") reject("GENERATOR_BUSY", "같은 대상의 생성이 진행 중입니다.");
    throw error;
  }
  let staging;
  const createdParents = [];
  let published = false;
  try {
    await inspectTarget(options.target);
    const parent = path.dirname(options.target);
    const missing = [];
    let cursor = parent;
    while (!(await stat(cursor))) {
      missing.push(cursor);
      cursor = path.dirname(cursor);
    }
    for (const directory of missing.reverse()) {
      await fs.mkdir(directory, { mode: 0o755 });
      createdParents.push(directory);
    }
    await inspectTarget(options.target);
    staging = await fs.mkdtemp(path.join(parent, ".sc-starter-stage-"));
    for (const item of output) {
      const destination = path.join(staging, relativeFile(item.file));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, item.bytes, { flag: "wx", mode: item.mode });
    }
    const current = await inspectTarget(options.target);
    if (
      original ? !current || current.ino !== original.ino || current.dev !== original.dev : current
    )
      reject("TARGET_CHANGED", "생성 중 대상이 변경되어 작업을 중단했습니다.");
    // 완성된 staging만 공개한다. 다른 generator는 동일 부모의 wx lock으로 직렬화한다.
    await fs.rename(staging, options.target);
    staging = undefined;
    published = true;
    return summary;
  } finally {
    if (staging) await fs.rm(staging, { recursive: true, force: true });
    if (!published)
      for (const directory of createdParents.reverse()) {
        try {
          await fs.rmdir(directory);
        } catch {
          /* 생성 중 다른 파일이 생긴 경로는 지우지 않는다. */
        }
      }
    await handle.close();
    await fs.unlink(lockFile);
  }
}
export async function main(args = process.argv.slice(2)) {
  const input = parseArguments(args);
  if (input.help) {
    console.log(
      "node scripts/create-starter.mjs --target <새 빈 경로> --name <kebab-case> --java-package <com.example.app> --frontend-port <1024..65535> --server-port <1024..65535> --artifacts <artifacts.json이 있는 폴더> [--dry-run]",
    );
    return;
  }
  console.log(JSON.stringify(await createStarter(input)));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(
      `${error.code ?? "GENERATOR_FAILED"}: ${error instanceof StarterGeneratorError || error.name === "PackageArtifactError" ? error.message : "생성을 완료할 수 없습니다."}`,
    );
    process.exitCode = 1;
  });
}
