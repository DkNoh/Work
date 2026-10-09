import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "docs/검증");
const stage = process.env.SC_VERIFY_STAGE ?? "006";
assert.match(stage, /^\d{3}$/);
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), "sc-a11y-gate-"));
const reportPath = resolve(temporary, "vitest.json");
const results = {
  stage,
  passed: false,
  expected: { cliExitCode: 1, tests: 1, failed: 1, skipped: 0, violation: "button-name" },
  pipeline:
    "@storybook/addon-vitest Browser → reused preview a11y.test:error → addon-a11y afterEach",
};
let log = "";
try {
  async function storyGlobs(path) {
    const text = await readFile(path, "utf8");
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const globs = [];
    function visit(node) {
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText(source) === "stories" &&
        ts.isArrayLiteralExpression(node.initializer)
      ) {
        for (const item of node.initializer.elements) {
          assert.ok(
            ts.isStringLiteral(item),
            "검증 구성의 story glob은 명시적인 문자열이어야 한다.",
          );
          globs.push(item.text);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return globs;
  }
  const normalGlobs = await storyGlobs(resolve(root, "frontend/apps/catalog/.storybook/main.ts"));
  const negativeGlobs = await storyGlobs(
    resolve(root, "frontend/apps/catalog/.storybook-negative/main.ts"),
  );
  assert.ok(
    normalGlobs.length > 0 && normalGlobs.every((glob) => glob.startsWith("../src/")),
    "실패 예제가 정상 카탈로그의 story glob에 포함되면 안 된다.",
  );
  assert.deepEqual(negativeGlobs, ["../negative/ScA11yFailure.stories.ts"]);
  results.catalogIsolation = { normalGlobs, negativeGlobs };
  results.normalCatalogIncludesNegativeFixture = false;
  const child = spawn(
    process.execPath,
    [
      resolve(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      "vitest.negative.config.ts",
    ],
    {
      cwd: resolve(root, "frontend/apps/catalog"),
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        CI: "1",
        STORYBOOK_DISABLE_TELEMETRY: "1",
        SC_A11Y_GATE_REPORT: reportPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    log += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    log += chunk;
  });
  const exit = await new Promise((done, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => done({ code, signal }));
  });
  results.cliExitCode = exit.code;
  results.signal = exit.signal;
  assert.equal(exit.signal, null, "signal 종료는 예상한 접근성 실패로 인정하지 않는다.");
  assert.equal(exit.code, 1, "의도한 접근성 위반에서 내부 Vitest CLI가 exit 1이어야 한다.");

  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(report.success, false);
  assert.equal(report.numTotalTests, 1, "실제 negative story 테스트가 정확히 1개 실행되어야 한다.");
  assert.equal(report.numFailedTests, 1);
  assert.equal(report.numPassedTests, 0);
  assert.equal(report.numPendingTests, 0);
  assert.equal(report.numTodoTests, 0);
  assert.equal(report.testResults.length, 1);
  const suite = report.testResults[0];
  assert.match(suite.name, /negative\/ScA11yFailure\.stories\.ts$/);
  assert.equal(suite.status, "failed");
  assert.equal(suite.assertionResults.length, 1);
  const assertion = suite.assertionResults[0];
  assert.equal(assertion.status, "failed");
  assert.match(
    assertion.fullName ?? assertion.title,
    /이름 없는 버튼|UnnamedVisibleButton|Unnamed Visible Button/,
  );
  const reason = stripVTControlCharacters(assertion.failureMessages.join("\n"));
  assert.match(reason, /toHaveNoViolations/, "addon의 실제 axe matcher 실패가 필요하다.");
  assert.match(reason, /Buttons must have discernible text \(button-name\)/);
  assert.match(reason, /data-sc-a11y-negative="unnamed-button"/);
  const violations = [
    ...new Set([...reason.matchAll(/\(([a-z]+(?:-[a-z]+)+)\)/g)].map((match) => match[1])),
  ];
  assert.deepEqual(violations, ["button-name"], "접근성 위반은 의도한 button-name 하나여야 한다.");
  assert.match(
    stripVTControlCharacters(log),
    /Buttons must have discernible text \(button-name\)/,
    "CLI에도 실제 접근성 실패 이유가 나타나야 한다.",
  );
  results.actual = {
    tests: report.numTotalTests,
    failed: report.numFailedTests,
    passed: report.numPassedTests,
    skipped: report.numPendingTests,
    todo: report.numTodoTests,
    story: assertion.fullName ?? assertion.title,
    violations,
    failureReason: reason,
  };
  results.passed = true;
  console.log(
    "접근성 실패 gate 통과: 실제 Storybook Browser 1개가 button-name으로 실패, 내부 exit 1 확인",
  );
} catch (error) {
  results.failure = String(error);
  process.exitCode = 1;
  console.error(`접근성 실패 gate 거절: ${results.failure}`);
} finally {
  await writeFile(resolve(output, `${stage}-a11y-negative.log`), stripVTControlCharacters(log));
  await writeFile(
    resolve(output, `${stage}-a11y-gate.json`),
    JSON.stringify(results, null, 2) + "\n",
  );
  await rm(temporary, { recursive: true, force: true });
}
