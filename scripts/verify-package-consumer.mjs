// 레포 밖 실제 tarball 설치를 검사한다. workspace alias나 소스 import로 산출물을 보완하지 않는다.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";

const exec = promisify(execFile);
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const options = {};
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  if (!["--consumer", "--report"].includes(key) || !process.argv[index + 1])
    throw new Error("--consumer <외부 앱> --report <JSON>을 지정하세요.");
  options[key] = path.resolve(process.argv[++index]);
}
const consumer = await fs.realpath(options["--consumer"]);
assert(
  consumer !== root && !consumer.startsWith(root + path.sep),
  "A real external consumer is required",
);
const reportFile = options["--report"];
assert(reportFile?.startsWith(path.join(root, "docs/검증") + path.sep));
const require = createRequire(path.join(consumer, "package.json"));
const probe = await fs.mkdtemp(path.join(consumer, ".sc-type-probe-"));
const report = {
  stage: process.env.SC_EVIDENCE_STAGE ?? "011",
  passed: false,
  consumer,
  workspaceAliases: 0,
  nativeLibraries: [],
  publicTypes: [],
  privateImports: [],
  vendorStrictProbe: null,
  sassTokens: null,
};
const baseline = `import { ScTextField, ScActionButton, type ScTextFieldProps } from '@sc/ui';
import { type ScTableColumn, ScDataTable, ScVirtualTable, ScVirtualList } from '@sc/ui/table';
import { ScChart } from '@sc/ui/charts';
import { ScRichTextEditor } from '@sc/ui/editor';
import { ScSortableBoard } from '@sc/ui/board';
import { ScImageAnnotator } from '@sc/ui/image';
import { createFrameworkRuntime, type Identity } from '@sc/runtime';
import { type ScWorkbookColumn } from '@sc/excel';
import { createDateFormatter } from '@sc/date';
import { createScI18n } from '@sc/i18n';
import '@sc/ui/styles';
const field: ScTextFieldProps = { modelValue: 'value', label: 'Title' };
const instance: InstanceType<typeof ScTextField>['$props'] = field;
declare const button: InstanceType<typeof ScActionButton>;
button.$emit('click', new MouseEvent('click'));
type Row = { id: string; amount: number };
const column: ScTableColumn<Row> = { id: 'amount', label: 'Amount', value: (row) => row.amount };
const workbook: ScWorkbookColumn<'title' | 'amount'> = { key: 'title', label: 'Title', type: 'string' };
const identity: Identity = { username: 'admin', roles: ['ADMIN'] };
type ExtendedIdentity = Identity & { displayName: string };
createFrameworkRuntime<ExtendedIdentity>({routes: [], decodeIdentity: () => ({username: 'admin', roles: ['ADMIN'], displayName: 'Admin'})});
void [instance, column, workbook, identity, createDateFormatter, createScI18n, ScDataTable, ScVirtualTable, ScVirtualList, ScChart, ScRichTextEditor, ScSortableBoard, ScImageAnnotator];
`;
async function compile(name, source, skipLibCheck = true, file = "probe.ts") {
  const directory = path.join(probe, name);
  await fs.mkdir(directory);
  await fs.writeFile(path.join(directory, file), source);
  await fs.writeFile(
    path.join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        skipLibCheck,
        noEmit: true,
        esModuleInterop: true,
        types: [],
      },
      include: [file],
    }),
  );
  let result;
  try {
    result = await exec(
      path.join(consumer, "node_modules/.bin/vue-tsc"),
      ["--pretty", "false", "--project", path.join(directory, "tsconfig.json")],
      { cwd: consumer, maxBuffer: 16 * 1024 * 1024 },
    );
    result.code = 0;
  } catch (error) {
    result = error;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .replaceAll(consumer, "<consumer>")
    .replaceAll(probe, "<type-probe>");
  await fs.writeFile(reportFile.replace(/\.json$/, `-${name}.log`), output);
  return { name, exit: result.code, output };
}
try {
  for (const name of ["@sc/date", "@sc/excel", "@sc/i18n", "@sc/runtime"]) {
    const resolved = require.resolve(name);
    assert(resolved.startsWith(path.join(consumer, "node_modules") + path.sep));
    const module = await import(pathToFileURL(resolved).href);
    assert(Object.keys(module).length > 0);
    report.nativeLibraries.push({ name, exports: Object.keys(module).sort() });
    if (name === "@sc/date") {
      assert.equal(module.isCalendarDate("0000-02-29"), true);
      assert.equal(module.isCalendarDate("2026-02-29"), false);
      assert.equal(
        module
          .createDateFormatter({ locale: "en", timeZone: "UTC" })
          .formatTimestamp("2026-01-01T00:00:00.123456789Z"),
        "2026-01-01 00:00:00 +00:00",
      );
    }
    if (name === "@sc/excel") {
      const columns = [
        { key: "title", label: "Title", type: "string" },
        { key: "amount", label: "Amount", type: "number" },
        { key: "date", label: "UTC", type: "date" },
      ];
      const rows = [
        { title: "한글", amount: 3, date: new Date("2026-01-01T00:00:00.000Z") },
        { title: "=SUM(1,2)", amount: null, date: null },
      ];
      const bytes = await module.writeWorkbook({ columns, rows });
      const result = await module.readWorkbook(bytes, { columns });
      assert.deepEqual(result.errors, []);
      assert.deepEqual(result.rows, rows);
      assert.deepEqual(result.sourceRowNumbers, [2, 3]);
    }
    if (name === "@sc/i18n") {
      const first = module.createScI18n({ locale: "ko" });
      const second = module.createScI18n({ locale: "en" });
      assert.equal(first.global.locale.value, "ko");
      assert.equal(second.global.locale.value, "en");
      assert.notEqual(
        first.global.t("common.actions.save"),
        second.global.t("common.actions.save"),
      );
    }
    if (name === "@sc/runtime") {
      const router = await import(pathToFileURL(require.resolve("vue-router")).href);
      const runtime = module.createFrameworkRuntime({
        routes: [],
        history: router.createMemoryHistory(),
      });
      assert.equal(runtime.session.identity, null);
      assert.equal(runtime.queryClient.getQueryCache().getAll().length, 0);
      runtime.dispose();
    }
  }
  for (const name of ["@sc/ui/src/contracts", "@sc/ui/dist/index.js", "@sc/runtime/src/http"]) {
    assert.throws(() => require.resolve(name), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
    report.privateImports.push({ name, expectedRejection: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
  }
  const positive = await compile("positive", baseline);
  assert.equal(positive.exit, 0, positive.output);
  report.publicTypes.push({ name: positive.name, exit: positive.exit });
  const negatives = [
    ["wrong-prop", baseline.replace("modelValue: 'value'", "modelValue: 42"), "TS2322"],
    ["wrong-emit", baseline.replace("new MouseEvent('click')", "'wrong event'"), "TS2345"],
    ["wrong-generic", baseline.replace("row.amount", "row.missing"), "TS2339"],
    [
      "wrong-identity",
      baseline.replace(
        "username: 'admin', roles: ['ADMIN'] };",
        "username: 42, roles: ['ADMIN'] };",
      ),
      "TS2322",
    ],
    [
      "missing-decoder",
      "import { createFrameworkRuntime, type Identity } from '@sc/runtime'; type ExtendedIdentity = Identity & {displayName: string}; createFrameworkRuntime<ExtendedIdentity>({routes: []});",
      "TS2345",
    ],
    [
      "private-type",
      "import { ScTextFieldProps } from '@sc/ui/src/contracts'; export type Probe = ScTextFieldProps;",
      "TS2307",
    ],
  ];
  for (const [name, source, code] of negatives) {
    const result = await compile(name, source);
    assert(result.exit !== 0 && result.output.includes(code), result.output);
    report.publicTypes.push({ name, expectedFailure: true, exit: result.exit, code });
  }
  const sfc = `<template>
<ScTextField v-model="title" label="Title" @update:model-value="saveTitle" />
<ScDataTable :rows="rows" :columns="columns" :get-row-key="getKey" caption="Rows">
<template #cell="{ row }">{{ row.amount }}</template>
</ScDataTable>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { ScTextField } from '@sc/ui';
import { ScDataTable, type ScTableColumn } from '@sc/ui/table';
type Row = { id: string; amount: number };
const rows: Row[] = [{id: 'first', amount: 1}];
const columns: ScTableColumn<Row>[] = [{id:'amount',label:'Amount',value: row => row.amount}];
const getKey = (row: Row) => row.id;
const title = ref('');
function saveTitle(value: string) { title.value = value; }
</script>`;
  const sfcPositive = await compile("sfc-positive", sfc, true, "Probe.vue");
  assert.equal(sfcPositive.exit, 0, sfcPositive.output);
  report.publicTypes.push({ name: sfcPositive.name, exit: sfcPositive.exit });
  for (const [name, source, code] of [
    ["sfc-generic-slot", sfc.replace("{{ row.amount }}", "{{ row.missing }}"), "TS2339"],
    [
      "sfc-wrong-model",
      sfc
        .replace("const title = ref('');", "const title = ref(42);")
        .replace("function saveTitle(value: string)", "function saveTitle(value: number)"),
      "TS2322",
    ],
    [
      "sfc-wrong-event",
      sfc.replace(
        "function saveTitle(value: string) { title.value = value; }",
        "function saveTitle(value: number) { title.value = String(value); }",
      ),
      "TS2322",
    ],
  ]) {
    const result = await compile(name, source, true, "Probe.vue");
    assert(result.exit !== 0 && result.output.includes(code), result.output);
    report.publicTypes.push({ name, expectedFailure: true, exit: result.exit, code });
  }
  const strict = await compile("vendor-strict", baseline, false);
  assert(strict.exit !== 0, "Expected vendor declaration conflicts must remain documented");
  const diagnostics = strict.output.split("\n").filter((line) => /error TS\d+/.test(line));
  assert(
    diagnostics.length > 0 &&
      diagnostics.every(
        (line) =>
          /node_modules\/(?:vuetify\/|typescript\/lib\/lib\.dom\.d\.ts)/.test(line) &&
          /TS2687|TS2308|TS2344/.test(line),
      ),
    strict.output,
  );
  report.vendorStrictProbe = {
    exit: strict.exit,
    diagnostics: diagnostics.length,
    supportedSkipLibCheck: true,
    ownSourceDiagnostics: 0,
    codes: [...new Set(diagnostics.map((line) => line.match(/TS\d+/)[0]))],
  };
  const nonUi = await compile(
    "non-ui-strict",
    "import { createFrameworkRuntime } from '@sc/runtime'; import { writeWorkbook } from '@sc/excel'; import { createScI18n } from '@sc/i18n'; import { createDateFormatter } from '@sc/date'; void [createFrameworkRuntime, writeWorkbook, createScI18n, createDateFormatter];",
    false,
  );
  assert.equal(nonUi.exit, 0, nonUi.output);
  report.publicTypes.push({ name: nonUi.name, exit: nonUi.exit, skipLibCheck: false });
  const sass = require("sass-embedded");
  const style = await sass.compileStringAsync(
    '@use "pkg:@sc/ui/tokens" as tokens with ($sc-emit-css: false); .consumer-probe { width: tokens.$sc-breakpoint-sm; }',
    { importers: [new sass.NodePackageImporter(consumer)] },
  );
  assert(style.css.includes("width: 768px;") && !style.css.includes(":root"));
  report.sassTokens = { publicPackageImporter: true, breakpoint: "768px", emitCssFalse: true };
  report.passed = true;
  console.log(
    "PASS external installed modules, XLSX, public types, private rejection and Sass tokens",
  );
} finally {
  await fs.rm(probe, { recursive: true, force: true });
  report.temporaryProbeRemoved = true;
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + "\n");
}
