import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = path.join(ROOT, "scripts/verify-package-artifacts.mjs");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function walkFiles(root) {
  const result = new Map();
  async function visit(folder) {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      assert(
        !entry.isSymbolicLink(),
        "The verified fixture source unexpectedly contains a symlink",
      );
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile())
        result.set(path.relative(root, file).split(path.sep).join("/"), await fs.readFile(file));
    }
  }
  await visit(root);
  return result;
}

async function protectedHashes(artifactRoot) {
  const result = {};
  const sourceFiles = [
    "package.json",
    "package-lock.json",
    "docs/ui-contracts.json",
    "scripts/verify-package-artifacts.mjs",
    "scripts/verify-package-gates.mjs",
  ];
  for (const name of ["ui", "runtime", "date", "excel", "i18n"]) {
    sourceFiles.push(`frontend/packages/${name}/package.json`);
    const registry = `frontend/packages/${name}/source-entries.json`;
    if (existsSync(path.join(ROOT, registry))) sourceFiles.push(registry);
    for (const file of ["tsconfig.build.json", "vite.library.config.mjs", "library/styles.ts"])
      if (existsSync(path.join(ROOT, `frontend/packages/${name}`, file)))
        sourceFiles.push(`frontend/packages/${name}/${file}`);
    const sources = await walkFiles(path.join(ROOT, `frontend/packages/${name}/src`));
    for (const [file, bytes] of sources)
      result[`source:frontend/packages/${name}/src/${file}`] = sha(bytes);
  }
  for (const file of [
    "build-library.mjs",
    "library-artifacts.mjs",
    "library-config.mjs",
    "package-framework.mjs",
  ])
    if (existsSync(path.join(ROOT, "scripts", file))) sourceFiles.push("scripts/" + file);
  for (const file of sourceFiles)
    result["source:" + file] = sha(await fs.readFile(path.join(ROOT, file)));
  for (const [file, bytes] of await walkFiles(artifactRoot))
    result["artifact:" + file] = sha(bytes);
  return result;
}

function octal(block, start, width, value) {
  const text = value.toString(8).padStart(width - 1, "0") + "\0";
  assert.equal(text.length, width, "A synthetic tar numeric field exceeded its width");
  block.write(text, start, width, "ascii");
}

function archive(entries) {
  const parts = [];
  for (const item of entries) {
    const header = Buffer.alloc(512);
    let name = item.name;
    let prefix = "";
    if (Buffer.byteLength(name) > 100) {
      const slash = name.lastIndexOf("/");
      prefix = name.slice(0, slash);
      name = name.slice(slash + 1);
    }
    assert(
      Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155,
      "A synthetic tar path exceeded ustar bounds",
    );
    header.write(name, 0, 100, "utf8");
    octal(header, 100, 8, 0o600);
    octal(header, 108, 8, 0);
    octal(header, 116, 8, 0);
    const bytes = item.bytes ?? Buffer.alloc(0);
    octal(header, 124, 12, bytes.length);
    octal(header, 136, 12, 0);
    header.fill(32, 148, 156);
    header.write(item.type ?? "0", 156, 1, "ascii");
    if (item.link) header.write(item.link, 157, 100, "utf8");
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    header.write(prefix, 345, 155, "utf8");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
    parts.push(header, bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(parts), { mtime: 0 });
}

function runChecker(artifactRoot, reportFile, expectedCode = null) {
  const child = spawnSync(
    process.execPath,
    [CHECKER, "--artifacts", artifactRoot, "--report", reportFile],
    { encoding: "utf8", timeout: 120_000, maxBuffer: 64 * 1024 },
  );
  const report = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, "utf8")) : null;
  const diagnostic = {
    exitCode: child.status,
    expectedCode,
    actualCode: report?.code ?? null,
    context: report?.context ?? null,
    stdout: (child.stdout ?? "").trim().slice(0, 400),
    stderr: (child.stderr ?? "").trim().slice(0, 400),
  };
  try {
    assert(
      !child.error && Number.isInteger(child.status),
      "The actual checker CLI did not complete",
    );
    assert(report, "The actual checker CLI did not produce its bounded report");
    if (expectedCode === null) {
      assert.equal(
        child.status,
        0,
        "The supplied real compiled artifacts did not pass their checker CLI",
      );
      assert.equal(report.passed, true);
      assert.equal(report.frontend.length, 5);
      assert.equal(report.backend.length, 7);
    } else {
      assert.notEqual(
        child.status,
        0,
        "An invalid archive unexpectedly passed its actual checker CLI",
      );
      assert.equal(report.passed, false);
      assert.equal(
        report.code,
        expectedCode,
        "The archive failed at an unexpected contract boundary",
      );
      assert(
        (child.stderr + child.stdout).includes(expectedCode),
        "The actual CLI did not print its bounded expected error code",
      );
    }
    assert.equal(report.packageCodeExecuted, false);
    assert.equal(
      report.temporaryDirectoryRemoved,
      true,
      "The checker left temporary archive extraction behind",
    );
    return {
      exitCode: child.status,
      code: report.code ?? null,
      temporaryDirectoryRemoved: report.temporaryDirectoryRemoved,
      stdout: diagnostic.stdout,
      stderr: diagnostic.stderr,
    };
  } catch (error) {
    error.gateDiagnostic = diagnostic;
    throw error;
  }
}

async function main() {
  let artifactRoot;
  let reportFile = path.join(ROOT, "docs/검증/011-package-gates.json");
  for (let index = 2; index < process.argv.length; index++) {
    const flag = process.argv[index];
    if (flag === "--artifacts") artifactRoot = process.argv[++index];
    else if (flag === "--report") reportFile = process.argv[++index];
    else throw new Error("Only --artifacts and --report are supported");
  }
  assert(
    typeof artifactRoot === "string" && typeof reportFile === "string",
    "--artifacts must identify root-created real compiled artifacts",
  );
  artifactRoot = await fs.realpath(path.resolve(artifactRoot));
  reportFile = path.resolve(reportFile);
  let reportParent = path.dirname(reportFile);
  const missingReportParts = [];
  while (!existsSync(reportParent)) {
    missingReportParts.unshift(path.basename(reportParent));
    reportParent = path.dirname(reportParent);
  }
  const reportStat = await fs.lstat(reportFile).catch(() => null);
  reportFile = path.join(
    await fs.realpath(reportParent),
    ...missingReportParts,
    path.basename(reportFile),
  );
  assert(
    reportFile.endsWith(".json") &&
      !reportFile.startsWith(artifactRoot + path.sep) &&
      (reportFile.startsWith(path.join(ROOT, "docs/검증") + path.sep) ||
        !reportFile.startsWith(ROOT + path.sep)),
    "Evidence must not overwrite artifact or source inputs",
  );
  assert(
    !reportStat || (reportStat.isFile() && !reportStat.isSymbolicLink()),
    "Evidence must be a regular JSON file",
  );
  const manifest = JSON.parse(await fs.readFile(path.join(artifactRoot, "artifacts.json"), "utf8"));
  const before = await protectedHashes(artifactRoot);
  const report = {
    stage: "011",
    passed: false,
    rootCreatedArtifactSeed: true,
    generatedSyntheticCompiledPackageClaimed: false,
    cases: [],
    protectedFiles: Object.keys(before).length,
    protectedChanged: [],
    temporaryDirectoryRemoved: false,
    packageCodeExecuted: false,
  };
  let temporary;
  let failure;
  let phase = "positive real artifact CLI";
  try {
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), "sc-package-gates-"));
    report.positive = runChecker(artifactRoot, path.join(temporary, "positive.json"));
    const packages = new Map();
    for (const item of manifest.frontend) {
      const destination = path.join(temporary, "verified-seed", item.name.slice(4));
      await fs.mkdir(destination, { recursive: true });
      // 앞의 actual CLI가 일반 파일·경로·links를 확인한 원본 archive만 여기서 추출한다.
      const child = spawnSync(
        "tar",
        ["-xzf", path.join(artifactRoot, item.file), "-C", destination],
        { encoding: "utf8", timeout: 20_000, maxBuffer: 64 * 1024 },
      );
      assert.equal(child.status, 0, "The already-verified seed archive could not be read");
      packages.set(item.name, await walkFiles(path.join(destination, "package")));
    }
    async function one(name, packageName, code, mutate, specialEntries) {
      phase = name;
      const root = path.join(temporary, "case-" + report.cases.length);
      await fs.mkdir(root);
      const fixtureManifest = structuredClone(manifest);
      for (const file of [
        ...fixtureManifest.frontend.map((item) => item.file),
        ...fixtureManifest.backend.files.map((item) => item.file),
      ]) {
        await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await fs.copyFile(path.join(artifactRoot, file), path.join(root, file));
      }
      const item = fixtureManifest.frontend.find((entry) => entry.name === packageName);
      const files = new Map(
        [...packages.get(packageName)].map(([file, bytes]) => [file, Buffer.from(bytes)]),
      );
      await mutate(files, fixtureManifest);
      const entries = [...files].map(([file, bytes]) => ({ name: "package/" + file, bytes }));
      if (specialEntries) specialEntries(entries);
      const bytes = archive(entries);
      await fs.writeFile(path.join(root, item.file), bytes);
      item.sha256 = sha(bytes);
      await fs.writeFile(
        path.join(root, "artifacts.json"),
        JSON.stringify(fixtureManifest, null, 2) + "\n",
      );
      const result = runChecker(
        root,
        path.join(temporary, "report-" + report.cases.length + ".json"),
        code,
      );
      report.cases.push({ name, passed: true, expectedCode: code, ...result });
      console.log("PASS " + name + ": " + code);
    }
    const append = (file, value) => (files) =>
      files.set(file, Buffer.concat([files.get(file), Buffer.from("\n" + value + "\n")]));
    await one(
      "cohort template ABI mismatch",
      "@sc/date",
      "SC_ARTIFACT_TEMPLATE_VERSION",
      (_files, value) => {
        value.templateVersion = value.templateVersion === 1 ? 2 : 1;
      },
    );
    await one(
      "unreleased cohort cannot select template",
      "@sc/date",
      "SC_ARTIFACT_TEMPLATE_VERSION",
      (_files, value) => {
        value.frameworkVersion = "0.4.0";
        value.templateVersion = 2;
      },
    );
    const changeManifest = (mutate) => (files) => {
      const value = JSON.parse(files.get("package.json"));
      mutate(value);
      files.set("package.json", Buffer.from(JSON.stringify(value)));
    };
    await one("export target missing", "@sc/date", "SC_PACKAGE_EXPORT_MISSING", (files) =>
      files.delete("dist/index.js"),
    );
    await one(
      "static relative import missing",
      "@sc/date",
      "SC_JS_RELATIVE_MISSING",
      append("dist/index.js", 'import "./missing-gate.js";'),
    );
    await one(
      "relative export missing",
      "@sc/date",
      "SC_JS_RELATIVE_MISSING",
      append("dist/index.js", 'export { nonexistent } from "./missing-gate.js";'),
    );
    await one(
      "dynamic relative import missing",
      "@sc/date",
      "SC_JS_RELATIVE_MISSING",
      append("dist/index.js", 'const gate = () => import("./missing-gate.js");'),
    );
    await one(
      "undeclared bare dependency",
      "@sc/date",
      "SC_JS_UNDECLARED_BARE",
      append("dist/index.js", 'import "sc-gate-unlisted-vendor";'),
    );
    await one(
      "workspace source alias",
      "@sc/date",
      "SC_JS_ABSOLUTE_ALIAS",
      append("dist/index.js", 'import "@sc/ui/src/private";'),
    );
    await one("forbidden raw source file", "@sc/date", "SC_PACKAGE_FORBIDDEN_FILE", (files) =>
      files.set("src/private.ts", Buffer.from("export const gate = true;")),
    );
    await one("forbidden runtime database file", "@sc/date", "SC_PACKAGE_FORBIDDEN_FILE", (files) =>
      files.set("dist/synthetic.mv.db", Buffer.from("synthetic fixture only")),
    );
    await one("forbidden source map", "@sc/date", "SC_PACKAGE_FORBIDDEN_FILE", (files) =>
      files.set("dist/index.js.map", Buffer.from("{}")),
    );
    await one(
      "private export",
      "@sc/ui",
      "SC_PACKAGE_PRIVATE_EXPORT",
      changeManifest((value) => {
        value.exports["./private"] = "./dist/index.js";
      }),
    );
    await one(
      "type-only component named re-export",
      "@sc/ui",
      "SC_UI_COMPONENT_EXPORT",
      (files) => {
        const source = files.get("dist/types/index.d.ts").toString("utf8");
        assert(
          source.includes("export { default as ScActionButton }"),
          "The real component declaration fixture changed",
        );
        files.set(
          "dist/types/index.d.ts",
          Buffer.from(
            source.replace(
              "export { default as ScActionButton }",
              "export type { default as ScActionButton }",
            ),
          ),
        );
      },
    );
    await one("type-only component star re-export", "@sc/ui", "SC_UI_COMPONENT_EXPORT", (files) => {
      const source = files.get("dist/types/index.d.ts").toString("utf8");
      assert(
        source.includes('export * from "./inputs/index.js"'),
        "The real component star fixture changed",
      );
      files.set(
        "dist/types/index.d.ts",
        Buffer.from(
          source.replace(
            'export * from "./inputs/index.js"',
            'export type * from "./inputs/index.js"',
          ),
        ),
      );
    });
    await one("missing public CSS", "@sc/ui", "SC_UI_CSS_MISSING", (files) =>
      files.delete("dist/sc-ui.css"),
    );
    await one(
      "absolute declaration import path",
      "@sc/date",
      "SC_DECL_ABSOLUTE_ALIAS",
      append(
        "dist/types/index.d.ts",
        'export type Gate = import("/synthetic/private/source.js").Private;',
      ),
    );
    await one(
      "dangling declaration relative type",
      "@sc/date",
      "SC_DECL_RELATIVE_MISSING",
      append("dist/types/index.d.ts", 'export type Gate = import("./missing-gate.js").Private;'),
    );
    await one("empty compiled root exports", "@sc/date", "SC_PACKAGE_EMPTY_MODULE", (files) => {
      files.set("dist/index.js", Buffer.from("export {};\n"));
      files.set("dist/types/index.d.ts", Buffer.from("export {};\n"));
    });
    await one("missing internal rights file", "@sc/date", "SC_PACKAGE_NOTICE", (files) =>
      files.delete("UNLICENSED"),
    );
    await one(
      "non-exact direct vendor",
      "@sc/date",
      "SC_VENDOR_EXACT_VERSION",
      changeManifest((value) => {
        value.dependencies.dayjs = "^1.11.23";
      }),
    );
    await one("invalid producer stamp digest", "@sc/date", "SC_PACKAGE_BUILD_STAMP", (files) => {
      const stamp = JSON.parse(files.get("dist/build-manifest.json"));
      stamp.inputsDigest = "invalid";
      files.set("dist/build-manifest.json", Buffer.from(JSON.stringify(stamp)));
    });
    await one(
      "archive traversal",
      "@sc/date",
      "SC_TAR_PATH",
      () => {},
      (entries) =>
        entries.push({ name: "package/../outside.txt", bytes: Buffer.from("synthetic") }),
    );
    await one(
      "archive absolute path",
      "@sc/date",
      "SC_TAR_PATH",
      () => {},
      (entries) =>
        entries.push({ name: "/synthetic/outside.txt", bytes: Buffer.from("synthetic") }),
    );
    await one(
      "archive symlink",
      "@sc/date",
      "SC_TAR_LINK",
      () => {},
      (entries) =>
        entries.push({
          name: "package/dist/gate-link",
          type: "2",
          link: "../../outside",
          bytes: Buffer.alloc(0),
        }),
    );
    await one(
      "archive hardlink",
      "@sc/date",
      "SC_TAR_LINK",
      () => {},
      (entries) =>
        entries.push({
          name: "package/dist/gate-link",
          type: "1",
          link: "package/dist/index.js",
          bytes: Buffer.alloc(0),
        }),
    );
    await one(
      "archive duplicate paths",
      "@sc/date",
      "SC_TAR_DUPLICATE",
      () => {},
      (entries) =>
        entries.push({ ...entries.find((entry) => entry.name === "package/package.json") }),
    );
    await one(
      "zero frontend artifacts",
      "@sc/date",
      "SC_ARTIFACT_FRONTEND_COUNT",
      (_files, value) => {
        value.frontend = [];
      },
    );
    report.passed = true;
  } catch (error) {
    failure = {
      phase,
      exceptionType: error?.constructor?.name ?? "Error",
      message: "Package gate verification stopped before all actual negative CLI cases passed",
      diagnostic: error?.gateDiagnostic ?? null,
    };
  } finally {
    try {
      const after = await protectedHashes(artifactRoot);
      report.protectedChanged = [
        ...new Set([...Object.keys(before), ...Object.keys(after)]),
      ].filter((file) => before[file] !== after[file]);
    } catch {
      report.protectedChanged = ["protected input inventory could not be reread"];
      report.passed = false;
    } finally {
      if (temporary) await fs.rm(temporary, { recursive: true, force: true });
    }
    report.temporaryDirectoryRemoved = !temporary || !existsSync(temporary);
    report.passed =
      report.passed && report.protectedChanged.length === 0 && report.temporaryDirectoryRemoved;
    if (failure) report.failure = failure;
    await fs.mkdir(path.dirname(path.resolve(reportFile)), { recursive: true });
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + "\n");
  }
  assert(report.passed, "Package gates failed; consult the bounded JSON report");
  console.log(
    `PASS package gates: ${report.cases.length} actual rejecting CLI cases, ${report.protectedFiles} immutable inputs, temporary fixtures removed`,
  );
}

try {
  await main();
} catch (error) {
  console.error(
    "SC_PACKAGE_GATES_FAILURE: " +
      (error instanceof assert.AssertionError
        ? "An expected package CLI gate did not match its contract"
        : "Package gate preparation failed"),
  );
  process.exitCode = 1;
}
