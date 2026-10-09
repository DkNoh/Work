// 실제 checker CLI를 임시 fixture에 실행한다. 제품 source/snapshot/manifest를 변조하지 않는다.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("..", import.meta.url));
const stage = process.env.SC_EVIDENCE_STAGE ?? "006";
if (!/^\d{3}$/.test(stage)) throw new Error("SC_EVIDENCE_STAGE는 세 자리 단계 번호여야 합니다.");
const reportPath = path.join(repository, `docs/검증/${stage}-framework-gates.json`);
const boundaryChecker = path.join(repository, "scripts/check-ui-boundaries.mjs");
const contractsChecker = path.join(repository, "scripts/ui-contracts.mjs");
const snapshot = path.join(repository, "docs/ui-contracts.json");
const results = [];
let fixture;
const report = {
  format: 1,
  result: "failed",
  cases: results,
  immutableInputs: null,
  cleanup: false,
};

async function write(filename, content) {
  const destination = path.join(fixture, filename);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(
    destination,
    typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`,
  );
}

async function protectedInputs() {
  const files = new Map();
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (
        [
          "node_modules",
          "dist",
          "storybook-static",
          "public",
          "test-results",
          "playwright-report",
        ].includes(entry.name)
      )
        continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else if (
        /\.(?:vue|ts|js|mjs|scss)$/.test(filename) ||
        ["package.json", "source-entries.json"].includes(entry.name)
      )
        files.set(
          path.relative(repository, filename),
          crypto
            .createHash("sha256")
            .update(await fs.readFile(filename))
            .digest("hex"),
        );
    }
  }
  await visit(path.join(repository, "frontend"));
  for (const filename of ["package.json", "package-lock.json", "docs/ui-contracts.json"])
    files.set(
      filename,
      crypto
        .createHash("sha256")
        .update(await fs.readFile(path.join(repository, filename)))
        .digest("hex"),
    );
  return Object.fromEntries([...files].sort(([left], [right]) => left.localeCompare(right)));
}

function runCase(name, script, arguments_, expectedExit, expectedMessage) {
  const child = spawnSync(process.execPath, [script, ...arguments_], {
    cwd: repository,
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 2 * 1024 * 1024,
    env: process.env,
  });
  const output = `${child.stdout ?? ""}${child.stderr ?? ""}`;
  const exitMatches =
    expectedExit === "nonzero" ? child.status !== null && child.status !== 0 : child.status === 0;
  const passed = !child.error && exitMatches && output.includes(expectedMessage);
  results.push({
    name,
    command: [
      "node",
      path.relative(repository, script),
      ...arguments_.map((argument) => argument.replace(fixture, "<temporary-fixture>")),
    ],
    expectedExit,
    actualExit: child.status,
    expectedMessage,
    passed,
    signal: child.signal,
    output: output.trim().replaceAll(fixture, "<temporary-fixture>"),
  });
  if (!passed)
    throw new Error(
      `${name}: 실제 CLI exit/message가 기대와 다릅니다. ${child.error?.message ?? output.trim()}`,
    );
}

const consumerProbe = "frontend/apps/alpha/src/probe.ts";
const sharedProbe = "frontend/packages/ui/src/probe.ts";
const publicViolation = (module) => `${module}의 공개 export를 사용하세요:`;
const negativeCases = [
  {
    name: "consumer-private-alias-static",
    file: consumerProbe,
    source: 'import { Button } from "@fixture/ui/src/private/Button";',
    message: publicViolation("@fixture/ui"),
  },
  {
    name: "consumer-runtime-private-export",
    file: consumerProbe,
    source: 'export { createRuntime } from "@fixture/runtime/src/index";',
    message: publicViolation("@fixture/runtime"),
  },
  {
    name: "consumer-private-relative-dynamic",
    file: consumerProbe,
    source: 'void import("../../../packages/ui/src/private/Button");',
    message: publicViolation("@fixture/ui"),
  },
  {
    name: "consumer-private-relative-directory",
    file: consumerProbe,
    source: 'import UI from "../../../packages/ui";',
    message: publicViolation("@fixture/ui"),
  },
  {
    name: "consumer-private-alias-scss-use",
    file: "frontend/apps/alpha/src/probe.scss",
    source: '@use "@fixture/ui/src/styles.scss";',
    message: publicViolation("@fixture/ui"),
  },
  {
    name: "consumer-private-relative-scss-forward",
    file: "frontend/apps/alpha/src/probe.scss",
    source: '@forward "../../../packages/ui/src/tokens.scss";',
    message: publicViolation("@fixture/ui"),
  },
  {
    name: "consumer-private-vue-script",
    file: "frontend/apps/alpha/src/Probe.vue",
    source:
      '<template><div>fixture</div></template>\n<script setup lang="ts">import { Button } from "@fixture/ui/src/private/Button";</script>',
    message: publicViolation("@fixture/ui"),
  },
  {
    name: "shared-app-static",
    file: sharedProbe,
    source: 'import { App } from "@fixture/alpha";',
    message: "공통 패키지가 소비 앱을 참조합니다:",
  },
  {
    name: "shared-app-export",
    file: sharedProbe,
    source: 'export { App } from "@fixture/beta/src/index";',
    message: "공통 패키지가 소비 앱을 참조합니다:",
  },
  {
    name: "shared-app-relative-dynamic",
    file: sharedProbe,
    source: 'void import("../../../apps/alpha/src/index");',
    message: "공통 패키지가 소비 앱을 참조합니다:",
  },
  {
    name: "shared-app-relative-scss",
    file: "frontend/packages/ui/src/probe.scss",
    source: '@use "../../../apps/beta/src/theme.scss";',
    message: "공통 패키지가 소비 앱을 참조합니다:",
  },
  {
    name: "app-app-declared-static",
    file: consumerProbe,
    source: 'import { App } from "@fixture/beta";',
    message: "소비 앱끼리 구현을 참조하지 마세요:",
  },
  {
    name: "app-app-export",
    file: consumerProbe,
    source: 'export { App } from "@fixture/beta/src/index";',
    message: "소비 앱끼리 구현을 참조하지 마세요:",
  },
  {
    name: "app-app-relative-dynamic",
    file: consumerProbe,
    source: 'void import("../../beta/src/index");',
    message: "소비 앱끼리 구현을 참조하지 마세요:",
  },
  {
    name: "app-app-relative-directory",
    file: consumerProbe,
    source: 'import { App } from "../../beta";',
    message: "소비 앱끼리 구현을 참조하지 마세요:",
  },
  {
    name: "app-app-relative-scss",
    file: "frontend/apps/alpha/src/probe.scss",
    source: '@forward "../../beta/src/theme.scss";',
    message: "소비 앱끼리 구현을 참조하지 마세요:",
  },
  {
    name: "shared-other-private-alias",
    file: sharedProbe,
    source: 'import { createRuntime } from "@fixture/runtime/src/index";',
    message: publicViolation("@fixture/runtime"),
  },
  {
    name: "shared-other-private-relative",
    file: sharedProbe,
    source: 'export { createRuntime } from "../../runtime/src/index";',
    message: publicViolation("@fixture/runtime"),
  },
  {
    name: "shared-other-private-dynamic",
    file: sharedProbe,
    source: 'void import("@fixture/runtime/src/index");',
    message: publicViolation("@fixture/runtime"),
  },
  {
    name: "shared-other-private-scss",
    file: "frontend/packages/ui/src/probe.scss",
    source: '@use "../../runtime/src/private.scss";',
    message: publicViolation("@fixture/runtime"),
  },
];

let initial;
try {
  initial = await protectedInputs();
  fixture = await fs.mkdtemp(path.join(os.tmpdir(), "sc-framework-gates-"));
  await write("frontend/packages/ui/package.json", {
    name: "@fixture/ui",
    exports: {
      ".": "./src/index.ts",
      "./styles": "./src/styles.scss",
      "./tokens": "./src/tokens.scss",
      "./table": "./src/table.ts",
      "./charts": "./src/charts.ts",
      "./editor": "./src/editor.ts",
    },
  });
  await write("frontend/packages/runtime/package.json", {
    name: "@fixture/runtime",
    exports: { ".": "./src/index.ts" },
  });
  await write("frontend/apps/alpha/package.json", {
    name: "@fixture/alpha",
    dependencies: { "@fixture/ui": "0.1.0", "@fixture/runtime": "0.1.0", "@fixture/beta": "0.1.0" },
  });
  await write("frontend/apps/beta/package.json", {
    name: "@fixture/beta",
    dependencies: { "@fixture/ui": "0.1.0" },
  });
  await write("frontend/packages/ui/src/index.ts", 'export { Button } from "./private/Button";');
  await write(
    "frontend/packages/ui/src/private/Button.ts",
    "export const Button = { fixture: true };\n",
  );
  for (const module of ["table", "charts", "editor"])
    await write(`frontend/packages/ui/src/${module}.ts`, `export const ${module} = true;\n`);
  await write("frontend/packages/ui/src/styles.scss", ".fixture { color: #123456; }\n");
  await write("frontend/packages/ui/src/tokens.scss", "$fixture-color: #123456;\n");
  await write(
    "frontend/packages/runtime/src/index.ts",
    "export const createRuntime = () => ({ fixture: true });\n",
  );
  await write("frontend/packages/runtime/src/private.scss", "$fixture-runtime: true;\n");
  for (const app of ["alpha", "beta"]) {
    await write(`frontend/apps/${app}/src/index.ts`, "export const App = { fixture: true };\n");
    await write(`frontend/apps/${app}/src/theme.scss`, ".app-fixture { color: #123456; }\n");
  }
  await write(
    "frontend/apps/alpha/src/public.ts",
    'import { Button } from "@fixture/ui";\nexport { table } from "@fixture/ui/table";\nvoid import("@fixture/ui/charts");\nexport { editor } from "@fixture/ui/editor";\nimport "@fixture/ui/styles";\nimport { createRuntime } from "@fixture/runtime";\nexport const fixture = { Button, createRuntime };\n',
  );
  await write(
    "frontend/apps/alpha/src/public.scss",
    '@use "@fixture/ui/tokens";\n@forward "@fixture/ui/styles";\n',
  );
  runCase(
    "public-consumer-imports",
    boundaryChecker,
    ["--root", fixture],
    0,
    "공개 UI/소비 앱 경계:",
  );
  await write(
    sharedProbe,
    'import { Button } from "@fixture/ui/src/private/Button";\nimport { createRuntime } from "@fixture/runtime";\nexport { Button, createRuntime };\n',
  );
  runCase(
    "shared-same-owner-private-and-other-public",
    boundaryChecker,
    ["--root", fixture],
    0,
    "공개 UI/소비 앱 경계:",
  );
  await fs.rm(path.join(fixture, sharedProbe));
  for (const entry of negativeCases) {
    await write(entry.file, entry.source);
    try {
      runCase(entry.name, boundaryChecker, ["--root", fixture], "nonzero", entry.message);
    } finally {
      await fs.rm(path.join(fixture, entry.file));
    }
  }
  const original = await fs.readFile(snapshot, "utf8");
  await write("ui-contracts-valid.json", original);
  runCase(
    "contracts-valid-snapshot",
    contractsChecker,
    ["--check", "--snapshot", path.join(fixture, "ui-contracts-valid.json")],
    0,
    "imported props/events/slots/default 계약 일치",
  );
  const modified = JSON.parse(original);
  const button = modified.components.find((component) => component.component === "ScActionButton");
  const busy = button?.props.find((prop) => prop.name === "busy");
  if (!busy || busy.default !== false)
    throw new Error("실제 ScActionButton.busy 기본값 false 계약을 찾지 못했습니다.");
  busy.default = true;
  await write("ui-contracts-drift.json", `${JSON.stringify(modified, null, 2)}\n`);
  runCase(
    "contracts-default-drift",
    contractsChecker,
    ["--check", "--snapshot", path.join(fixture, "ui-contracts-drift.json")],
    "nonzero",
    "공개 UI 계약이 변경되었습니다.",
  );
  report.result = "passed";
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  try {
    if (initial) {
      const final = await protectedInputs();
      const changed = [...new Set([...Object.keys(initial), ...Object.keys(final)])].filter(
        (filename) => initial[filename] !== final[filename],
      );
      report.immutableInputs = { checked: Object.keys(initial).length, changed };
      if (changed.length) {
        report.result = "failed";
        report.error = [report.error, `검증 중 제품 파일이 변경되었습니다: ${changed.join(", ")}`]
          .filter(Boolean)
          .join("\n");
        process.exitCode = 1;
      }
    }
  } catch (error) {
    report.result = "failed";
    report.error = [report.error, error instanceof Error ? error.message : String(error)]
      .filter(Boolean)
      .join("\n");
    process.exitCode = 1;
  } finally {
    // hash 재검사 자체가 실패해도 fixture와 변조된 임시 snapshot을 제거한다.
    if (fixture) {
      try {
        await fs.rm(fixture, { recursive: true, force: true });
        report.cleanup = true;
      } catch (error) {
        report.result = "failed";
        report.error = [
          report.error,
          `임시 fixture 정리 실패: ${error instanceof Error ? error.message : String(error)}`,
        ]
          .filter(Boolean)
          .join("\n");
        process.exitCode = 1;
      }
    }
  }
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      result: report.result,
      passed: results.filter((result) => result.passed).length,
      cases: results.length,
      report: path.relative(repository, reportPath),
      immutableInputs: report.immutableInputs,
      cleanup: report.cleanup,
    }),
  );
}
