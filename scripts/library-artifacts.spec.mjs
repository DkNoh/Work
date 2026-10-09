import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { normalizeDeclarations, writeThirdPartyNotices } from "./library-artifacts.mjs";

async function withDirectory(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sc-library-artifacts-"));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("declaration AST normalizes nested imports and Vue declaration paths without editing text", async () => {
  await withDirectory(async (directory) => {
    await fs.mkdir(path.join(directory, "inputs"));
    await fs.writeFile(path.join(directory, "inputs/index.d.ts"), "export interface Field {}\n");
    await fs.writeFile(
      path.join(directory, "ScExample.vue.d.ts"),
      "export default class Example {}\n",
    );
    await fs.writeFile(path.join(directory, "contracts.d.ts"), "export interface Variant {}\n");
    await fs.writeFile(
      path.join(directory, "index.d.ts"),
      [
        "// User documentation retains './contracts' unchanged.",
        "export { default } from './ScExample.vue';",
        "import type { Field } from './inputs';",
        "export type Nested = import('vue').DefineComponent<{ field: import('./contracts').Variant }>;",
        "export type Instruction = 'open ./contracts';",
      ].join("\n"),
    );
    await normalizeDeclarations(directory);
    const output = await fs.readFile(path.join(directory, "index.d.ts"), "utf8");
    assert.match(output, /from "\.\/ScExample\.vue\.js"/);
    assert.match(output, /from "\.\/inputs\/index\.js"/);
    assert.match(output, /import\("\.\/contracts\.js"\)\.Variant/);
    assert.match(output, /import\("vue"\)/);
    assert.match(output, /User documentation retains '\.\/contracts' unchanged/);
    assert.match(output, /'open \.\/contracts'/);
    await normalizeDeclarations(directory);
    assert.equal(await fs.readFile(path.join(directory, "index.d.ts"), "utf8"), output);
  });
});

test("dangling declaration import stops library completion", async () => {
  await withDirectory(async (directory) => {
    await fs.writeFile(path.join(directory, "index.d.ts"), "export * from './missing';\n");
    await assert.rejects(normalizeDeclarations(directory), /Dangling declaration import/);
  });
});

test("import-only vendor license is copied from package-local installation without executing it", async () => {
  await withDirectory(async (directory) => {
    const installed = path.join(directory, "node_modules/fixture-vendor");
    await fs.mkdir(installed, { recursive: true });
    await fs.writeFile(path.join(directory, "package.json"), '{"name":"fixture-library"}\n');
    await fs.writeFile(
      path.join(installed, "package.json"),
      JSON.stringify({
        name: "fixture-vendor",
        version: "1.0.0",
        license: "MIT",
        exports: { import: "./must-not-execute.js" },
      }),
    );
    const original = "MIT fixture license\nOriginal copyright and terms remain unchanged.\n";
    await fs.writeFile(path.join(installed, "LICENSE"), original);
    await writeThirdPartyNotices(directory, {
      name: "@sc/fixture",
      version: "0.1.0",
      dependencies: { "fixture-vendor": "1.0.0" },
    });
    assert.ok(
      (await fs.readFile(path.join(directory, "THIRD_PARTY_NOTICES"), "utf8")).includes(original),
    );
  });
});

test("a directory named LICENSE does not satisfy original license evidence", async () => {
  await withDirectory(async (directory) => {
    const installed = path.join(directory, "node_modules/fixture-vendor");
    await fs.mkdir(path.join(installed, "LICENSE"), { recursive: true });
    await fs.writeFile(path.join(directory, "package.json"), '{"name":"fixture-library"}\n');
    await fs.writeFile(
      path.join(installed, "package.json"),
      JSON.stringify({ name: "fixture-vendor", version: "1.0.0", license: "MIT" }),
    );
    await assert.rejects(
      writeThirdPartyNotices(directory, {
        name: "@sc/fixture",
        version: "0.1.0",
        dependencies: { "fixture-vendor": "1.0.0" },
      }),
      /Original license text is missing/,
    );
  });
});
