import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = resolve(root, "frontend/apps/catalog/storybook-static");
const output = resolve(root, "docs/검증");
const stage = process.env.SC_VERIFY_STAGE ?? "005";
assert.match(stage, /^\d{3}(?:-[a-z0-9]+)*$/);
const index = JSON.parse(await readFile(resolve(directory, "index.json"), "utf8"));
const contracts = JSON.parse(await readFile(resolve(root, "docs/ui-contracts.json"), "utf8"));
assert.equal(contracts.format, 2, "명시 기본값을 구분하는 계약 snapshot format 2가 필요합니다.");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const leakedApiRequests = [];
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname === "/api" || pathname.startsWith("/api/")) leakedApiRequests.push(pathname);
    const file = resolve(
      directory,
      `.${pathname.endsWith("/") ? pathname + "index.html" : pathname}`,
    );
    if (relative(directory, file).startsWith("..")) throw new Error("path");
    const contents = await readFile(file);
    response.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
    response.end(contents);
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await mkdir(output, { recursive: true });
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const results = {
  stage,
  staticBuild: true,
  docs: [],
  controls: [],
  browserErrors: [],
  leakedApiRequests,
  captures: [],
  virtualMetrics: [],
  storyCompletions: [],
  extractionNotes: [
    "초기 format 1의 default:null은 미기재와 명시 null을 구분하지 못했다. 현재 format 2의 defaultSpecified로 구분하고 명시 null의 실제 Docs 기본값도 검사한다.",
    "vue-component-meta generic 표시는 object/unknown 제약 타입으로 특수화될 수 있다. 실제 배열 표시와 자체 타입·vendor 비노출을 검사한다.",
  ],
  pendingControls: [
    "ScTextField",
    "ScAppShell",
    "ScSelect",
    "ScCheckbox",
    "ScTextArea",
    "ScConfirmDialog",
    "ScRichTextEditor",
    "ScDataTable",
    "ScSortableBoard",
    "ScImageAnnotator",
  ],
};
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (error) => results.browserErrors.push(error.message));
  await page.addInitScript(() => {
    // play/afterEach 완료 전 manager 조작은 iframe 키보드 포커스를 빼앗을 수 있다.
    window.__SC_VERIFY_STORY_FINISHED__ = {};
    window.__SC_VERIFY_ARGS_EVENTS__ = [];
    const subscribe = () => {
      const channel = window.__STORYBOOK_PREVIEW__?.channel;
      if (channel?.on) {
        channel.on("storyFinished", (event) => {
          window.__SC_VERIFY_STORY_FINISHED__[event.storyId] = event;
        });
        // manager가 숨긴 iframe의 RAF는 늦게 시작할 수 있어 채널 구독은 timer로 연결한다.
      } else setTimeout(subscribe, 10);
    };
    subscribe();
  });
  function entry(component, type, exportName = "Default") {
    const found = Object.values(index.entries).find(
      (item) =>
        item.importPath.endsWith(`/${component}.stories.ts`) &&
        item.type === type &&
        (type === "docs" || item.exportName === exportName),
    );
    assert.ok(found, `${component} ${type} 항목 누락`);
    return found;
  }
  async function capture(name) {
    const filename = `${stage}-${name}.png`;
    await page.screenshot({ path: resolve(output, filename), fullPage: true });
    results.captures.push(filename);
  }
  async function auditIds(scope, component) {
    const audit = await scope.locator("[id]").evaluateAll((elements) => {
      const counts = new Map();
      for (const element of elements)
        if (element.id.startsWith("sc-")) counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
      return {
        count: counts.size,
        duplicates: [...counts]
          .filter(([, count]) => count > 1)
          .map(([id, count]) => ({ id, count })),
      };
    });
    assert.deepEqual(audit.duplicates, [], `${component}: sc 공통/fixture ID 중복`);
    return audit;
  }
  async function finished(frame, story) {
    await frame.waitForFunction(
      (id) =>
        Boolean(window.__SC_VERIFY_STORY_FINISHED__?.[id]) ||
        window.__STORYBOOK_PREVIEW__?.storyRenders?.some(
          (render) => render.id === id && render.phase === "finished",
        ),
      story.id,
      { timeout: 30000 },
    );
    const completion = await frame.evaluate((id) => {
      const event = window.__SC_VERIFY_STORY_FINISHED__?.[id];
      return {
        id,
        status: event?.status ?? "finished-phase",
        reports: event?.reporters?.filter((report) => report.status === "failed") ?? [],
      };
    }, story.id);
    assert.notEqual(completion.status, "error", `${story.id}: play/afterEach 실패`);
    assert.deepEqual(completion.reports, [], `${story.id}: Story 보고 실패`);
    await expect(frame.locator(".sb-errordisplay")).not.toBeVisible();
    results.storyCompletions.push(completion);
  }
  function completedControl(result) {
    results.controls.push(result);
    results.pendingControls = results.pendingControls.filter((name) => name !== result.component);
  }
  for (const contract of contracts.components) {
    const docs = entry(contract.component, "docs");
    await page.goto(`${origin}/iframe.html?id=${encodeURIComponent(docs.id)}&viewMode=docs`);
    const table = page.locator("table.docblock-argstable").first();
    await expect(table).toBeVisible();
    const names = [...contract.props, ...contract.events, ...contract.slots].map(
      (item) => item.name,
    );
    for (const name of names) {
      await expect(table.getByText(name, { exact: true }).first()).toBeVisible();
    }
    const defaults = [];
    const genericTypes = [];
    for (const prop of contract.props) {
      const row = table
        .getByRole("row")
        .filter({ has: page.getByText(prop.name, { exact: true }) });
      if (
        ["ScDataTable", "ScVirtualTable", "ScVirtualList"].includes(contract.component) &&
        ["rows", "columns", "items"].includes(prop.name)
      ) {
        const type = await row.getByRole("cell").nth(1).textContent();
        // vue-component-meta는 generic을 제약 타입(object/unknown)으로 특수화한다.
        // 렌더러 타입을 숨기기 위한 수동 argTypes 대신 실제 공개 배열 표시를 확인한다.
        assert.match(type, /\[\]|Array</, `${contract.component}.${prop.name}: 배열 타입 누락`);
        if (prop.name === "columns") {
          assert.match(
            type,
            /ScTableColumn/,
            `${contract.component}.columns: 자체 column 타입 누락`,
          );
        }
        assert.doesNotMatch(
          type,
          /ColumnDef|TableOptions|VirtualizerOptions|FlexRender/,
          "vendor 타입 공개",
        );
        genericTypes.push({ prop: prop.name, extracted: prop.type, displayed: type });
      }
      assert.equal(
        typeof prop.defaultSpecified,
        "boolean",
        `${contract.component}.${prop.name}: defaultSpecified 누락`,
      );
      if (!prop.defaultSpecified || prop.default === undefined || prop.default === "undefined")
        continue;
      const cell = row.getByRole("cell").nth(2);
      if (typeof prop.default === "string") {
        await expect(cell).toContainText(JSON.stringify(prop.default));
        assert.doesNotMatch(
          await cell.textContent(),
          /\\u[\da-f]{4}/i,
          `${contract.component}.${prop.name}: 유니코드 escape 표시`,
        );
      } else if (["boolean", "number"].includes(typeof prop.default) || prop.default === null)
        await expect(cell).toHaveText(String(prop.default));
      else if (Array.isArray(prop.default) && prop.default.length === 0)
        await expect(cell).toContainText("[]");
      else if (typeof prop.default === "object" && Object.keys(prop.default).length === 0)
        await expect(cell).toContainText("{}");
      defaults.push({
        prop: prop.name,
        expected: prop.default,
        displayed: await cell.textContent(),
      });
    }
    const internalProps = [
      "density",
      "theme",
      "elevation",
      "clearable",
      "hideDetails",
      "items",
      "itemTitle",
      "itemValue",
      "returnObject",
      "editor",
      "extensions",
      "options",
      "tableOptions",
      "virtualizerOptions",
      "renderCell",
    ];
    for (const name of internalProps.filter(
      (name) => !contract.props.some((prop) => prop.name === name),
    ))
      await expect(table.getByText(name, { exact: true })).toHaveCount(0);
    const ids = await auditIds(page, contract.component);
    results.docs.push({
      component: contract.component,
      props: contract.props.length,
      events: contract.events.length,
      slots: contract.slots.length,
      duplicateIds: ids.duplicates,
      generatedIdCount: ids.count,
      defaults,
      genericTypes,
    });
    await capture(`${contract.component}-docs`);
    const tableCapture = `${stage}-${contract.component}-contracts.png`;
    await table.screenshot({ path: resolve(output, tableCapture) });
    results.captures.push(tableCapture);
  }

  let activeControlsFrame;
  let activeControlsStory;
  async function controlsFor(component, exportName = "Default") {
    const story = entry(component, "story", exportName);
    await page.goto(`${origin}/?path=/story/${encodeURIComponent(story.id)}`);
    const canvas = page.frameLocator("#storybook-preview-iframe");
    await expect(page.locator("#storybook-preview-iframe")).toBeVisible();
    const handle = await page.locator("#storybook-preview-iframe").elementHandle();
    const frame = await handle.contentFrame();
    assert.ok(frame);
    activeControlsFrame = frame;
    activeControlsStory = story;
    await finished(frame, story);
    await frame.evaluate(() => {
      // manager 로드 뒤의 실제 iframe 채널로 Controls 변경을 기록한다.
      const channel = window.__STORYBOOK_ADDONS_CHANNEL__ ?? window.__STORYBOOK_PREVIEW__?.channel;
      window.__SC_VERIFY_ARGS_EVENTS__ = [];
      for (const type of ["updateStoryArgs", "storyArgsUpdated"]) {
        channel?.on(type, (event) => {
          const args = event.updatedArgs ?? event.args ?? {};
          window.__SC_VERIFY_ARGS_EVENTS__.push({
            type,
            storyId: event.storyId,
            modelValue: args.modelValue,
            selectedKeys: args.selectedKeys,
            disabled: args.disabled,
            readonly: args.readonly,
          });
        });
      }
    });
    await auditIds(frame, component);
    await page.getByRole("tab", { name: /Controls/ }).click();
    const table = page.getByRole("table").first();
    await expect(table).toBeVisible();
    return { table, canvas, frame };
  }
  async function argsUpdated(name, value) {
    // Storybook은 렌더·animation·afterEach 후 manager에 최종 args를 전달한다.
    // 기본 5초 assertion보다 그 실제 완료 이벤트를 먼저 기다린다.
    await activeControlsFrame.waitForFunction(
      ({ name, json }) =>
        JSON.stringify(
          window.__SC_VERIFY_ARGS_EVENTS__?.findLast(
            (event) => event.type === "storyArgsUpdated",
          )?.[name],
        ) === json,
      { name, json: JSON.stringify(value) },
      { timeout: 15000 },
    );
    await finished(activeControlsFrame, activeControlsStory);
  }
  function controlRow(table, name) {
    return table.getByRole("row").filter({ has: page.getByText(name, { exact: true }) });
  }
  function control(table, name) {
    return table
      .getByRole("row")
      .filter({ has: page.getByText(name, { exact: true }) })
      .locator("textarea, input[type='text']")
      .first();
  }
  async function jsonControl(table, name) {
    const row = controlRow(table, name);
    await expect(row).toBeVisible();
    const editor = row.getByPlaceholder("Edit JSON string...");
    const edit = row.getByRole("switch", { name: `Edit ${name} as JSON`, exact: true });
    const setter = row.getByRole("button", { name: "Set object", exact: true });
    // ObjectControl의 JSON 편집 토글은 버튼 태그지만 접근성 role은 switch다.
    try {
      await expect
        .poll(async () => (await editor.count()) + (await edit.count()) + (await setter.count()))
        .toBeGreaterThan(0);
    } catch (error) {
      results.failedJsonControl = { name, accessibility: await row.ariaSnapshot() };
      await capture("json-control-failure");
      throw error;
    }
    if (!(await editor.count())) {
      if (await edit.count()) await edit.click();
      else await setter.click();
    }
    await expect(editor).toBeVisible();
    return editor;
  }
  async function writeJson(table, name, value) {
    const editor = await jsonControl(table, name);
    await editor.fill(JSON.stringify(value));
    await editor.blur();
    await argsUpdated(name, value);
    return editor;
  }
  async function stringModel(table, name, value) {
    const row = controlRow(table, name);
    const json = row.getByPlaceholder("Edit JSON string...");
    const input = (await json.count()) ? json : control(table, name);
    await expect(input).toBeVisible();
    if (value !== undefined) {
      await input.fill((await json.count()) ? JSON.stringify(value) : value);
      await input.blur();
      await argsUpdated(name, value);
    }
    return { input, json: Boolean(await json.count()) };
  }
  async function booleanControl(table, name, value) {
    const row = controlRow(table, name);
    const setter = row.getByRole("button", { name: "Set boolean", exact: true });
    if (await setter.count()) await setter.click();
    const input = row.getByRole("switch", { name, exact: true });
    await expect(input).toBeVisible();
    if (value !== undefined && (await input.isChecked()) !== value) {
      // addon의 switch 장식은 숨겨진 native input 위에 있으므로 키보드로 조작한다.
      await input.focus();
      await input.press("Space");
      await expect(input).toBeChecked({ checked: value });
      await argsUpdated(name, value);
    }
    return input;
  }
  {
    const { table, canvas } = await controlsFor("ScTextField");
    const input = canvas.getByRole("textbox", { name: "제목" });
    await expect(input).toHaveValue("긴 한국어 제목");
    const model = control(table, "modelValue");
    await model.fill("Controls에서 바꾼 제목");
    await model.blur();
    await argsUpdated("modelValue", "Controls에서 바꾼 제목");
    await expect(input).toHaveValue("Controls에서 바꾼 제목");
    await input.fill("캔버스에서 바꾼 제목");
    await input.blur();
    await argsUpdated("modelValue", "캔버스에서 바꾼 제목");
    await expect(model).toHaveValue("캔버스에서 바꾼 제목");
    const label = control(table, "label");
    await label.fill("바뀐 필드 이름");
    await label.blur();
    await expect(canvas.getByRole("textbox", { name: "바뀐 필드 이름" })).toHaveValue(
      "캔버스에서 바꾼 제목",
    );
    completedControl({
      component: "ScTextField",
      controlsToCanvas: true,
      canvasToArgs: true,
      labelReactive: true,
    });
    await capture("ScTextField-controls");
    await page.getByRole("button", { name: "Reset controls" }).click();
    await expect(control(table, "modelValue")).toHaveValue("");
    await expect(canvas.getByRole("textbox", { name: "제목" })).toHaveValue("");
    results.controls.at(-1).reset = true;
  }
  {
    const { table, canvas } = await controlsFor("ScAppShell");
    await expect(canvas.getByRole("link", { name: "조회 보고서" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const activeItem = control(table, "activeItem");
    await activeItem.fill("settings");
    await activeItem.blur();
    await expect(canvas.getByRole("link", { name: "설정" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await canvas.getByRole("link", { name: "예제 업무" }).click();
    await expect(activeItem).toHaveValue("examples");
    completedControl({
      component: "ScAppShell",
      controlsToCanvas: true,
      navigateToArgs: true,
    });
  }
  {
    const { table, canvas, frame } = await controlsFor("ScSelect", "KeyboardSelection");
    await expect(canvas.getByRole("status", { name: "선택 미리보기" })).toHaveText("review");
    const model = await stringModel(table, "modelValue", "general");
    await expect(canvas.getByRole("status", { name: "선택 미리보기" })).toHaveText("general");
    const select = canvas.getByRole("combobox", { name: "업무 구분" });
    await select.focus();
    await select.press("Enter");
    await canvas.getByRole("option", { name: "검토 업무", exact: true }).click();
    await expect(canvas.getByRole("status", { name: "선택 미리보기" })).toHaveText("review");
    await argsUpdated("modelValue", "review");
    results.selectChannelDiagnostics = {
      nativeValue: await select.inputValue(),
      preview: await canvas.getByRole("status", { name: "선택 미리보기" }).textContent(),
      events: await frame.evaluate(() => window.__SC_VERIFY_ARGS_EVENTS__),
      managerValue: await model.input.inputValue(),
    };
    await expect(model.input).toHaveValue(model.json ? JSON.stringify("review") : "review");
    completedControl({
      component: "ScSelect",
      controlsToCanvas: true,
      canvasToArgs: true,
      value: "review",
    });
    await capture("ScSelect-controls");
  }
  {
    const { table, canvas } = await controlsFor("ScCheckbox", "KeyboardToggle");
    const checkbox = canvas.getByRole("checkbox", { name: "입력한 내용을 확인했습니다." });
    const model = await booleanControl(table, "modelValue", true);
    await expect(checkbox).toBeChecked();
    await checkbox.focus();
    await checkbox.press("Space");
    await argsUpdated("modelValue", false);
    await expect(model).not.toBeChecked();
    completedControl({
      component: "ScCheckbox",
      controlsToCanvas: true,
      canvasToArgs: true,
      nativeKeyboard: true,
    });
    await capture("ScCheckbox-controls");
  }
  {
    const { table, canvas } = await controlsFor("ScTextArea", "Multiline");
    const textarea = canvas.getByRole("textbox", { name: "업무 설명" });
    await expect(textarea).toHaveValue("긴 한국어 설명\n두 번째 줄");
    const model = control(table, "modelValue");
    await model.fill("Controls 설명\n둘째 줄");
    await model.blur();
    await argsUpdated("modelValue", "Controls 설명\n둘째 줄");
    await expect(textarea).toHaveValue("Controls 설명\n둘째 줄");
    await textarea.fill("캔버스 설명\n입력 확정");
    await textarea.blur();
    await argsUpdated("modelValue", "캔버스 설명\n입력 확정");
    await expect(model).toHaveValue("캔버스 설명\n입력 확정");
    completedControl({
      component: "ScTextArea",
      controlsToCanvas: true,
      canvasToArgs: true,
      nativeChangeCommit: true,
    });
    await capture("ScTextArea-controls");
  }
  {
    const { table, canvas } = await controlsFor("ScConfirmDialog", "KeyboardCancel");
    const model = await booleanControl(table, "modelValue", true);
    const dialog = canvas.getByRole("dialog", { name: "미저장 입력 확인" });
    await expect(dialog).toBeVisible();
    await canvas.getByRole("button", { name: "계속 작성", exact: true }).click();
    await argsUpdated("modelValue", false);
    await expect(model).not.toBeChecked();
    await expect(dialog).not.toBeVisible();
    await canvas.getByRole("button", { name: "확인 대화상자 열기" }).click();
    await argsUpdated("modelValue", true);
    await expect(model).toBeChecked();
    await canvas.getByRole("button", { name: "계속 작성", exact: true }).click();
    await argsUpdated("modelValue", false);
    await expect(model).not.toBeChecked();
    completedControl({
      component: "ScConfirmDialog",
      controlsToCanvas: true,
      canvasToArgs: true,
      parentOwnsClose: true,
    });
    await capture("ScConfirmDialog-controls");
  }
  {
    const { table, canvas } = await controlsFor("ScRichTextEditor", "EditAndValidate");
    const document = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Controls에서 받은 본문" }] }],
    };
    const model = await writeJson(table, "modelValue", document);
    const editor = canvas.getByRole("textbox", { name: "본문" });
    await expect(editor).toHaveText("Controls에서 받은 본문");
    await editor.fill("캔버스에서 확정한 본문");
    await editor.blur();
    await argsUpdated("modelValue", {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "캔버스에서 확정한 본문" }] }],
    });
    await expect
      .poll(async () => JSON.parse(await model.inputValue()))
      .toEqual({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "캔버스에서 확정한 본문" }] },
        ],
      });
    completedControl({
      component: "ScRichTextEditor",
      controlsToCanvas: true,
      canvasToArgs: true,
      jsonModel: true,
      blurCommit: true,
    });
    await capture("ScRichTextEditor-controls");
  }
  {
    const { table, canvas } = await controlsFor("ScDataTable", "ClientSortingAndSelection");
    const model = await writeJson(table, "selectedKeys", ["outside-page", "row-00044"]);
    const selected = canvas.getByRole("checkbox", { name: "자료 44 선택", exact: true });
    await expect(selected).toBeChecked();
    await selected.uncheck();
    await argsUpdated("selectedKeys", ["outside-page"]);
    await expect.poll(async () => JSON.parse(await model.inputValue())).toEqual(["outside-page"]);
    await canvas.getByRole("checkbox", { name: "자료 43 선택", exact: true }).check();
    await argsUpdated("selectedKeys", ["outside-page", "row-00043"]);
    await expect
      .poll(async () => JSON.parse(await model.inputValue()))
      .toEqual(["outside-page", "row-00043"]);
    completedControl({
      component: "ScDataTable",
      controlsToCanvas: true,
      canvasToArgs: true,
      arrayModel: true,
      preservesOutsidePage: true,
    });
    await capture("ScDataTable-controls");
  }
  {
    const { table, canvas } = await controlsFor("ScSortableBoard", "Readonly");
    const handle = canvas.getByRole("button", { name: "이동: Alpha", exact: true });
    await expect(handle).toBeDisabled();
    await booleanControl(table, "disabled", false);
    await expect(handle).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Alpha: 아래로", exact: true })).toBeVisible();
    await booleanControl(table, "disabled", true);
    await expect(handle).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Alpha: 아래로", exact: true })).toHaveCount(0);
    await expect(canvas.getByRole("link", { name: "Alpha 상세", exact: true })).toBeVisible();
    completedControl({
      component: "ScSortableBoard",
      controlsToCanvas: true,
      disabledReactive: true,
      detailRemainsReadable: true,
      movementOwnedByApp: true,
    });
    await capture("ScSortableBoard-controls");
  }
  {
    const { table, canvas } = await controlsFor("ScImageAnnotator", "Readonly");
    const apply = canvas.getByRole("button", { name: "좌표 적용", exact: true });
    await expect(apply).toBeDisabled();
    await booleanControl(table, "readonly", false);
    await expect(apply).toBeEnabled();
    const box = { x: 0.2, y: 0.2, width: 0.3, height: 0.4 };
    const model = await writeJson(table, "modelValue", box);
    await expect(canvas.getByLabel("가로 시작", { exact: true })).toHaveValue("0.2");
    await canvas.getByLabel("가로 시작", { exact: true }).fill("0.15");
    await apply.click();
    await argsUpdated("modelValue", { ...box, x: 0.15 });
    await expect
      .poll(async () => JSON.parse(await model.inputValue()))
      .toEqual({ ...box, x: 0.15 });
    await booleanControl(table, "readonly", true);
    await expect(apply).toBeDisabled();
    completedControl({
      component: "ScImageAnnotator",
      controlsToCanvas: true,
      canvasToArgs: true,
      jsonModel: true,
      readonlyReactive: true,
    });
    await capture("ScImageAnnotator-controls");
  }
  for (const [component, exportName, dataset] of [
    ["ScVirtualTable", "TenThousandScrollSelectionAndFallback", "scVirtualMetrics"],
    ["ScVirtualTable", "VariableHeightResizeAndReplacement", "scVirtualResizeMetrics"],
    ["ScVirtualList", "TenThousandKeyboardAndCleanup", "scVirtualMetrics"],
  ]) {
    const story = entry(component, "story", exportName);
    await page.goto(`${origin}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`);
    await finished(page, story);
    await page.waitForFunction(
      (name) => Boolean(document.getElementById("storybook-root")?.dataset[name]),
      dataset,
    );
    const metric = await page.evaluate(
      (name) => JSON.parse(document.getElementById("storybook-root").dataset[name]),
      dataset,
    );
    if (dataset === "scVirtualMetrics") {
      assert.equal(metric.rows, 10000);
      assert.equal(metric.viewport, 480);
      assert.equal(metric.minimumRow, 48);
      assert.equal(metric.overscan, 8);
      const counts = metric.firstMiddleLastSorted ?? metric.firstMiddleLast;
      assert.ok(Array.isArray(counts) && counts.length >= 3);
      assert.ok(counts.every((count) => Number.isInteger(count) && count > 0 && count <= 64));
      assert.equal(metric.maximum, Math.max(...counts));
    } else {
      assert.ok(metric.before > 0 && metric.after > metric.before);
      assert.ok(metric.width > 0 && metric.width <= 390);
      assert.ok(metric.dataDOM > 0 && metric.dataDOM <= 64);
    }
    const ids = await auditIds(page, story.id);
    results.virtualMetrics.push({
      component,
      story: exportName,
      metric,
      duplicateIds: ids.duplicates,
    });
    await capture(`${component}-${exportName}`);
  }
  for (const [exportName, expected] of [
    ["Loaded", "Storybook 합성 예제"],
    ["RequestError", "모의 조회 오류입니다."],
  ]) {
    const story = entry("ConnectedExamples", "story", exportName);
    await page.goto(`${origin}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`);
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  }
  // 모의 응답이 빠진 업무 API도 실제 네트워크로 전송되면 실패한다.
  const isolationProbes = await page.evaluate(async () => {
    const controller = navigator.serviceWorker.controller?.scriptURL ?? null;
    const results = [];
    for (const path of ["/api", "/api/sc-unhandled-probe", "/api/node_modules/sc-contract.js"]) {
      try {
        const response = await fetch(path);
        results.push({ path, blocked: false, status: response.status, controller });
      } catch (error) {
        results.push({ path, blocked: true, error: String(error), controller });
      }
    }
    return results;
  });
  results.isolationProbes = isolationProbes;
  assert.equal(
    isolationProbes.every(({ blocked }) => blocked),
    true,
    "MSW의 미정의 API 차단 정책이 동작하지 않습니다.",
  );
  results.unhandledApiBlocked = true;
  results.mockStories = ["Loaded", "RequestError"];
  assert.deepEqual(results.pendingControls, [], "대표 Controls 검증 누락");
  assert.deepEqual(results.browserErrors, []);
  assert.deepEqual(leakedApiRequests, [], "모의 API가 정적 서버로 전달되었습니다.");
  results.storyCount = Object.values(index.entries).filter((item) => item.type === "story").length;
  results.docsCount = Object.values(index.entries).filter((item) => item.type === "docs").length;
  results.passed = true;
  console.log(
    `정적 Storybook: Docs ${results.docs.length}개 공개 계약, Controls ${results.controls.length}개, 브라우저 오류 0`,
  );
} catch (error) {
  results.passed = false;
  results.failure = String(error);
  throw error;
} finally {
  await writeFile(
    resolve(output, `${stage}-storybook-browser.json`),
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser?.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
