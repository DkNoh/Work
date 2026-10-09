#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  parseArguments,
  validateOptions,
  inspectTarget,
  readTemplateBundle,
  createStarter,
  selectTemplateVersion,
} from "./create-starter.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);
const templateRoot = path.join(root, "templates/starter-v1");
const operationsTemplateRoot = path.join(root, "templates/starter-v2");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
async function digestTree(directory) {
  const entries = [];
  async function visit(folder) {
    for (const entry of (await fs.readdir(folder, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) await visit(file);
      else
        entries.push([
          path.relative(directory, file),
          entry.isSymbolicLink() ? await fs.readlink(file) : hash(await fs.readFile(file)),
        ]);
    }
  }
  await visit(directory);
  return hash(JSON.stringify(entries));
}
export async function verifyStarterGenerator({ artifacts } = {}) {
  const checks = [];
  const templateBefore = await digestTree(templateRoot);
  const operationsTemplateBefore = await digestTree(operationsTemplateRoot);
  const temporary = await fs.mkdtemp(
    path.join(await fs.realpath(os.tmpdir()), "sc-generator-check-"),
  );
  const base = {
    target: path.join(temporary, "new-app"),
    name: "neutral-demo",
    javaPackage: "dev.demo.app",
    frontendPort: "5178",
    serverPort: "18088",
    artifacts: artifacts ?? path.join(temporary, "missing-artifacts"),
  };
  async function check(name, operation) {
    try {
      await operation();
    } catch (error) {
      error.verificationCase = name;
      throw error;
    }
    checks.push({ name, passed: true });
  }
  async function reject(name, operation, code) {
    await check(name, async () => {
      await assert.rejects(
        async () => operation(),
        (error) => error.code === code,
      );
    });
  }
  let actualGeneration = false;
  try {
    await check("versioned-template-selection-retains-v1-compatibility", () => {
      assert.equal(selectTemplateVersion("0.1.0"), 1);
      assert.equal(selectTemplateVersion("0.2.0"), 1);
      assert.equal(selectTemplateVersion("0.3.0"), 2);
    });
    for (const version of ["0.4.0", "0.3.0-rc.1", "", undefined])
      await reject(
        `unsupported-framework-${checks.length}`,
        () => selectTemplateVersion(version),
        "TEMPLATE_VERSION",
      );
    await check("parse-help-and-explicit-options", () => {
      assert.deepEqual(parseArguments(["--help"]), { help: true });
      const args = [
        "--target",
        base.target,
        "--name",
        base.name,
        "--java-package",
        base.javaPackage,
        "--frontend-port",
        base.frontendPort,
        "--server-port",
        base.serverPort,
        "--artifacts",
        base.artifacts,
        "--dry-run",
      ];
      assert.equal(parseArguments(args).dryRun, true);
      assert.equal(validateOptions(base).frontendPort, 5178);
    });
    for (const [name, args, code] of [
      ["missing-options", [], "MISSING_ARGUMENT"],
      ["unknown-option", ["--force"], "INVALID_ARGUMENT"],
      ["duplicate-option", ["--target", "a", "--target", "b"], "INVALID_ARGUMENT"],
      ["duplicate-dry-run", ["--dry-run", "--dry-run"], "INVALID_ARGUMENT"],
      ["missing-option-value", ["--target", "--name"], "INVALID_ARGUMENT"],
    ])
      await reject(name, () => parseArguments(args), code);
    for (const name of ["BadName", "../x", "bad--name", "bad_name", "a".repeat(51)])
      await reject(
        `invalid-name-${checks.length}`,
        () => validateOptions({ ...base, name }),
        "INVALID_NAME",
      );
    for (const javaPackage of [
      "single",
      "dev.class.app",
      "Dev.demo",
      "dev..demo",
      "dev.bad-name",
      "dev.var",
      "dev.record",
    ])
      await reject(
        `invalid-java-package-${checks.length}`,
        () => validateOptions({ ...base, javaPackage }),
        "INVALID_JAVA_PACKAGE",
      );
    for (const frontendPort of ["0", "1023", "65536", "05178", "5178.1", "NaN"])
      await reject(
        `invalid-port-${checks.length}`,
        () => validateOptions({ ...base, frontendPort }),
        "INVALID_PORT",
      );
    await reject(
      "same-port",
      () => validateOptions({ ...base, serverPort: base.frontendPort }),
      "PORT_CONFLICT",
    );
    for (const target of [
      root,
      path.join(root, "new-app"),
      path.resolve(root, "../WorkboardVue/new-app"),
      path.resolve(root, "../workboard/new-app"),
      path.parse(root).root,
    ])
      await reject(
        `protected-target-${checks.length}`,
        () => validateOptions({ ...base, target }),
        "PROTECTED_TARGET",
      );
    await reject(
      "path-control-character",
      () => validateOptions({ ...base, target: "unsafe\npath" }),
      "INVALID_PATH",
    );
    const occupied = path.join(temporary, "occupied");
    await fs.mkdir(occupied);
    await fs.writeFile(path.join(occupied, "user.txt"), "user-owned-content");
    const occupiedBefore = await digestTree(occupied);
    await reject(
      "occupied-no-overwrite",
      () => createStarter({ ...base, target: occupied }),
      "TARGET_OCCUPIED",
    );
    assert.equal(await digestTree(occupied), occupiedBefore);
    const linked = path.join(temporary, "link");
    await fs.symlink(occupied, linked);
    await reject("target-symlink", () => inspectTarget(linked), "SYMLINK_TARGET");
    await reject(
      "ancestor-symlink",
      () => inspectTarget(path.join(linked, "child")),
      "SYMLINK_TARGET",
    );
    const fileTarget = path.join(temporary, "file-target");
    await fs.writeFile(fileTarget, "owned");
    await reject("file-target", () => inspectTarget(fileTarget), "INVALID_TARGET");
    await check("explicit-template-checksums", async () => {
      const bundle = await readTemplateBundle();
      assert.ok(bundle.entries.length > 40);
      assert.ok(bundle.entries.some((entry) => entry.target.endsWith("NoteService.java")));
      assert.ok(bundle.entries.some((entry) => entry.target === "scripts/build.sh"));
      assert.ok(
        bundle.entries.every(
          (entry) =>
            !entry.target.includes("reference-app") &&
            !entry.target.startsWith(".runtime/") &&
            !entry.target.includes("package-lock"),
        ),
      );
    });
    await check("v2-explicit-operational-files-and-public-contract-boundary", async () => {
      const bundle = await readTemplateBundle(operationsTemplateRoot);
      assert.equal(bundle.lock.templateVersion, 2);
      assert.deepEqual(bundle.lock.compatibleFrameworkVersions, ["0.3.0"]);
      assert.ok(
        bundle.entries.some((entry) => entry.target.endsWith("V3__operations_messages.sql")),
      );
      assert.ok(
        bundle.entries.some((entry) =>
          entry.target.endsWith("V4__operations_scheduler_browser.sql"),
        ),
      );
      assert.ok(
        bundle.entries.some((entry) =>
          entry.target.endsWith("GeneratedOperationsIntegrationTest.java"),
        ),
      );
      const api = bundle.entries
        .find((entry) => entry.target === "frontend/src/features/operations/api.ts")
        .bytes.toString();
      assert.ok(api.includes("ApiComponents") && !api.includes("generated/api"));
      const collector = bundle.entries
        .find((entry) => entry.target === "frontend/src/features/operations/capabilities.ts")
        .bytes.toString();
      assert.ok(collector.includes('appVersion: "1.0.0"') && collector.includes('"notes"'));
      for (const entry of bundle.entries) {
        assert.ok(!entry.target.startsWith(".runtime/") && !entry.target.includes("package-lock"));
        assert.ok(
          !/dev\.scframework\.reference|apps\/reference-app|packages\/runtime\/src/.test(
            entry.bytes.toString(),
          ),
        );
      }
    });
    await check("v2-private-secret-helper-exclusive-copy-and-check", async () => {
      const { prepareOperations } = await import(
        pathToFileURL(path.join(operationsTemplateRoot, "scripts/prepare-operations.mjs"))
      );
      const source = path.join(temporary, "private-source");
      await fs.mkdir(source, { mode: 0o700 });
      for (const name of ["spring.rabbitmq.password", "observer.secret"])
        await fs.writeFile(path.join(source, name), crypto.randomBytes(32).toString("base64url"), {
          mode: 0o600,
        });
      const home = path.join(temporary, "private-home");
      await prepareOperations({ home, source });
      await prepareOperations({ home, check: true });
      for (const name of ["spring.rabbitmq.password", "observer.secret"]) {
        const target = path.join(home, "secrets/operations", name);
        assert.equal((await fs.stat(target)).mode & 0o777, 0o600);
        assert.deepEqual(await fs.readFile(target), await fs.readFile(path.join(source, name)));
      }
      const before = await digestTree(home);
      await assert.rejects(prepareOperations({ home, source }));
      assert.equal(await digestTree(home), before);
      const link = path.join(temporary, "linked-private-source");
      await fs.symlink(source, link);
      await assert.rejects(
        prepareOperations({ home: path.join(temporary, "private-rejected"), source: link }),
      );
      await assert.rejects(fs.access(path.join(temporary, "private-rejected")));
    });
    await check("portable-vendor-uri-before-project-model", async () => {
      const appRoot = path.join(temporary, "a space 한글");
      await fs.mkdir(appRoot);
      const result = await execute(
        process.execPath,
        [path.join(templateRoot, "scripts/vendor-uri.mjs"), "./backend"],
        { cwd: appRoot },
      );
      assert.equal(result.stdout.trim(), pathToFileURL(path.join(appRoot, "vendor/maven")).href);
      assert.equal(result.stderr, "");
    });
    await check("custom-settings-selected-without-default-override", async () => {
      const helper = path.join(templateRoot, "scripts/vendor-uri.mjs");
      for (const [args, expected] of [
        [[], "default"],
        [["-B", "clean", "package"], "default"],
        [["--global-settings", "global.xml"], "default"],
        [["-s", "custom.xml"], "custom"],
        [["--settings", "custom.xml"], "custom"],
        [["--settings=custom.xml"], "custom"],
        [["-scustom.xml"], "custom"],
      ]) {
        const result = await execute(process.execPath, [helper, "--settings-mode", ...args]);
        assert.equal(result.stdout.trim(), expected);
        assert.equal(result.stderr, "");
      }
    });
    const changedTemplate = path.join(temporary, "changed-template");
    await fs.cp(templateRoot, changedTemplate, { recursive: true });
    await fs.appendFile(path.join(changedTemplate, "README.md"), "\nchanged\n");
    await reject(
      "changed-template-checksum",
      () => readTemplateBundle(changedTemplate),
      "TEMPLATE_HASH_MISMATCH",
    );
    const invalidTemplate = path.join(temporary, "invalid-template");
    await fs.cp(templateRoot, invalidTemplate, { recursive: true });
    const lockFile = path.join(invalidTemplate, "template.json");
    const lock = JSON.parse(await fs.readFile(lockFile, "utf8"));
    lock.files[0].target = "../outside";
    await fs.writeFile(lockFile, JSON.stringify(lock));
    await reject(
      "template-path-traversal",
      () => readTemplateBundle(invalidTemplate),
      "INVALID_FILE_PATH",
    );
    if (artifacts) {
      const beforeDryRun = await digestTree(temporary);
      await check("actual-artifacts-dry-run-no-files", async () => {
        const result = await createStarter({ ...base, dryRun: true });
        assert.equal(result.dryRun, true);
        assert.equal(result.frontendArtifacts, 5);
        assert.equal(result.backendArtifacts, 7);
        assert.equal(result.installsExecuted, false);
        assert.equal(await digestTree(temporary), beforeDryRun);
      });
      await check("atomic-complete-new-app", async () => {
        await createStarter(base);
        actualGeneration = true;
        const provenance = JSON.parse(
          await fs.readFile(path.join(base.target, "sc-starter.lock.json"), "utf8"),
        );
        const manifest = JSON.parse(
          await fs.readFile(path.join(base.target, "package.json"), "utf8"),
        );
        assert.equal(manifest.name, base.name);
        assert.equal(manifest.dependencies["vue-i18n"], "11.1.12");
        assert.equal(provenance.installsExecuted, false);
        const artifactsManifest = JSON.parse(
          await fs.readFile(path.join(artifacts, "artifacts.json"), "utf8"),
        );
        assert.equal(
          provenance.templateVersion,
          selectTemplateVersion(artifactsManifest.frameworkVersion),
        );
        assert.equal(
          provenance.files.filter((entry) => entry.file.startsWith("vendor/")).length,
          12,
        );
        assert.ok(!manifest.workspaces);
        for (const name of ["ui", "runtime", "date", "excel", "i18n"]) {
          const spec = manifest.dependencies[`@sc/${name}`];
          assert.ok(spec.startsWith("file:vendor/npm/"));
          await fs.access(path.join(base.target, spec.slice(5)));
        }
        for (const entry of provenance.files)
          assert.equal(hash(await fs.readFile(path.join(base.target, entry.file))), entry.sha256);
        await assert.rejects(fs.access(path.join(base.target, "node_modules")));
        await assert.rejects(fs.access(path.join(base.target, "frontend/src/generated/api.d.ts")));
        await assert.rejects(fs.access(path.join(base.target, ".runtime")));
      });
      const generatedBefore = await digestTree(base.target);
      await reject("repeat-create-no-overwrite", () => createStarter(base), "TARGET_OCCUPIED");
      assert.equal(await digestTree(base.target), generatedBefore);
      await check("existing-empty-target", async () => {
        const target = path.join(temporary, "empty-target");
        await fs.mkdir(target);
        await createStarter({ ...base, target });
        assert.ok(await fs.readFile(path.join(target, "package.json")));
      });
      await check("concurrent-target-one-publish", async () => {
        const target = path.join(temporary, "concurrent");
        const results = await Promise.allSettled([
          createStarter({ ...base, target }),
          createStarter({ ...base, target }),
        ]);
        assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
        const rejected = results.find((result) => result.status === "rejected");
        assert.ok(
          ["GENERATOR_BUSY", "TARGET_OCCUPIED", "TARGET_CHANGED"].includes(rejected.reason.code),
        );
        assert.ok(await fs.readFile(path.join(target, "sc-starter.lock.json")));
      });
      const changedArtifacts = path.join(temporary, "changed-artifacts");
      await fs.cp(artifacts, changedArtifacts, { recursive: true });
      const manifestFile = path.join(changedArtifacts, "artifacts.json");
      const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
      manifest.frontend[0].sha256 = "0".repeat(64);
      await fs.writeFile(manifestFile, JSON.stringify(manifest));
      await check("artifact-hash-failure-no-target", async () => {
        const target = path.join(temporary, "rejected-artifacts");
        await assert.rejects(
          createStarter({ ...base, target, artifacts: changedArtifacts }),
          (error) => error.name === "PackageArtifactError",
        );
        await assert.rejects(fs.access(target));
      });
    }
    await check("source-template-unchanged", async () =>
      assert.equal(await digestTree(templateRoot), templateBefore),
    );
    await check("v2-source-template-unchanged", async () =>
      assert.equal(await digestTree(operationsTemplateRoot), operationsTemplateBefore),
    );
    await check("no-staging-or-generator-lock-left", async () => {
      const entries = await fs.readdir(temporary);
      assert.ok(
        entries.every(
          (name) => !name.startsWith(".sc-starter-stage-") && !name.endsWith(".sc-generator.lock"),
        ),
      );
    });
    return {
      passed: true,
      checks,
      actualArtifacts: !!artifacts,
      actualGeneration,
      installsExecuted: false,
      mavenExecuted: false,
      browserExecuted: false,
      cleanConsumerVerification: "parent-owned; not executed by this validator",
      temporaryDirectoryRemoved: true,
    };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
export async function main(args = process.argv.slice(2)) {
  let artifacts;
  let reportFile;
  for (let i = 0; i < args.length; i++) {
    if (!["--artifacts", "--report"].includes(args[i]) || !args[i + 1])
      throw new Error("Use --artifacts <actual artifact directory> and/or --report <JSON path>.");
    if (args[i] === "--artifacts") artifacts = path.resolve(args[++i]);
    else reportFile = path.resolve(args[++i]);
  }
  const report = await verifyStarterGenerator({ artifacts });
  if (reportFile) {
    await fs.mkdir(path.dirname(reportFile), { recursive: true });
    await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    const code = /^[A-Z_]+$/.test(error.code ?? "") ? error.code : "GENERATOR_VERIFICATION_FAILED";
    console.error(`Verification boundary: ${code}; case: ${error.verificationCase ?? "setup"}`);
    console.error("Starter generator verification failed; no secret or file content was printed.");
    process.exitCode = 1;
  });
}
