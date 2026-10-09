// 검증을 마친 JS/타입/CSS와 plain Maven 라이브러리만 내부 배포 세트로 보관한다.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { libraryInputsDigest } from "./library-artifacts.mjs";
import { expectedTemplateVersion } from "./verify-package-artifacts.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const names = ["date", "i18n", "excel", "ui", "runtime"];
const coordinates = [
  "sc-framework-parent",
  "framework-core",
  "framework-autoconfigure",
  "framework-spring-boot-starter",
];
const options = {};
for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index];
  if (!["--output", "--maven-repository"].includes(flag) || !process.argv[index + 1])
    throw new Error(
      "사용법: node scripts/package-framework.mjs --output <새 경로> --maven-repository <검증한 격리 Maven 저장소>",
    );
  options[flag] = path.resolve(process.argv[++index]);
}
if (!options["--output"] || !options["--maven-repository"])
  throw new Error("새 배포 경로와 검증한 Maven 저장소를 지정하세요.");
const output = options["--output"];
try {
  await fs.lstat(output);
  throw new Error("기존 배포 폴더를 덮어쓰지 않습니다.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const repository = await fs.realpath(options["--maven-repository"]);
const parentPom = await fs.readFile(path.join(root, "backend/pom.xml"), "utf8");
const backendVersion = parentPom.match(
  /<sc-framework.version>([^<]+)<\/sc-framework.version>/,
)?.[1];
if (!backendVersion || !/^\d+\.\d+\.\d+(?:-SNAPSHOT)?$/.test(backendVersion))
  throw new Error("Maven 공통 버전을 확인할 수 없습니다.");
const manifests = [];
for (const name of names) {
  const directory = path.join(root, "frontend/packages", name);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, "package.json"), "utf8"));
  const stamp = JSON.parse(
    await fs.readFile(path.join(directory, "dist/build-manifest.json"), "utf8"),
  );
  if (manifest.private !== true || manifest.license !== "UNLICENSED")
    throw new Error(`${manifest.name}: 내부 패키지 정책이 올바르지 않습니다.`);
  if (
    stamp.format !== 1 ||
    stamp.name !== manifest.name ||
    stamp.version !== manifest.version ||
    stamp.inputsDigest !== (await libraryInputsDigest(directory))
  )
    throw new Error(`${manifest.name}: 현재 버전으로 다시 검증·빌드해야 합니다.`);
  manifests.push(manifest);
}
if (new Set(manifests.map(({ version }) => version)).size !== 1)
  throw new Error("다섯 프런트 공통 패키지의 배포 버전이 다릅니다.");
const templateVersion = expectedTemplateVersion(manifests[0].version);
if (templateVersion === null || backendVersion !== manifests[0].version + "-SNAPSHOT")
  throw new Error(
    "SC_ARTIFACT_TEMPLATE_VERSION: framework cohort/템플릿/Maven 버전 선택을 확인하세요.",
  );
await fs.mkdir(path.dirname(output), { recursive: true });
const staging = await fs.mkdtemp(path.join(path.dirname(output), ".sc-package-"));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
let outputCreated = false;
let completed = false;
try {
  const frontend = [];
  const packRecords = [];
  for (const manifest of manifests) {
    // consumer install/pack에서 소스 빌드를 수행해 누락 산출물을 복구하지 않는다.
    const { stdout } = await exec(
      "npm",
      [
        "pack",
        "--workspace",
        manifest.name,
        "--json",
        "--ignore-scripts",
        "--pack-destination",
        staging,
      ],
      { cwd: root, maxBuffer: 4 * 1024 * 1024 },
    );
    const record = JSON.parse(stdout);
    if (
      record.length !== 1 ||
      record[0].name !== manifest.name ||
      record[0].version !== manifest.version
    )
      throw new Error("npm pack 결과의 이름·버전이 다릅니다.");
    const filename = record[0].filename;
    if (path.basename(filename) !== filename || !filename.endsWith(".tgz"))
      throw new Error("npm pack 파일 이름이 올바르지 않습니다.");
    const bytes = await fs.readFile(path.join(staging, filename));
    frontend.push({
      name: manifest.name,
      version: manifest.version,
      file: filename,
      sha256: hash(bytes),
    });
    packRecords.push(record[0]);
  }
  const files = [];
  for (const artifact of coordinates) {
    for (const extension of artifact === "sc-framework-parent" ? ["pom"] : ["pom", "jar"]) {
      const relative = `dev/scframework/${artifact}/${backendVersion}/${artifact}-${backendVersion}.${extension}`;
      const input = path.join(repository, relative);
      const stat = await fs.lstat(input);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error("Maven 산출물은 일반 파일이어야 합니다.");
      const bytes = await fs.readFile(input);
      const destination = path.join(staging, "maven", relative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, bytes, { flag: "wx" });
      files.push({ file: `maven/${relative}`, sha256: hash(bytes) });
    }
  }
  const result = {
    format: 1,
    templateVersion,
    frameworkVersion: manifests[0].version,
    frontend,
    backend: { version: backendVersion, repository: "maven", artifacts: coordinates, files },
    toolchain: { node: "24.16.0", npm: "11.13.0", java: "21", springBoot: "3.5.16" },
  };
  await fs.writeFile(path.join(staging, "artifacts.json"), JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
  });
  await fs.writeFile(
    path.join(staging, "npm-pack.json"),
    JSON.stringify(packRecords, null, 2) + "\n",
    { flag: "wx" },
  );
  // 마지막에 exclusive 대상 디렉터리를 확보하여 다른 생성 작업을 덮어쓰지 않는다.
  await fs.mkdir(output);
  outputCreated = true;
  for (const filename of await fs.readdir(staging))
    await fs.rename(path.join(staging, filename), path.join(output, filename));
  completed = true;
  console.log(
    JSON.stringify({
      result: "packaged",
      frontend: frontend.length,
      mavenFiles: files.length,
      version: result.frameworkVersion,
      output,
    }),
  );
} finally {
  if (outputCreated && !completed) await fs.rm(output, { recursive: true, force: true });
  await fs.rm(staging, { recursive: true, force: true });
}
