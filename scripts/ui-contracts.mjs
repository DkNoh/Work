import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createChecker } from "vue-component-meta";
import { existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import ts from "typescript";

const root = new URL("../", import.meta.url);
let checking = false;
let destination = fileURLToPath(new URL("docs/ui-contracts.json", root));
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === "--check") checking = true;
  else if (argument === "--snapshot" && process.argv[index + 1])
    destination = resolve(process.argv[++index]);
  else throw new Error("사용법: node scripts/ui-contracts.mjs [--check] [--snapshot <JSON 파일>]");
}
const checker = createChecker(
  fileURLToPath(new URL("frontend/apps/catalog/tsconfig.docgen.json", root)),
  { forceUseTs: true, noDeclarations: true, schema: false },
);
const uiRoot = fileURLToPath(new URL("frontend/packages/ui/", root));
const manifest = JSON.parse(await readFile(resolve(uiRoot, "package.json"), "utf8"));
const components = [];
const visited = new Set();
async function collectPublicComponents(file) {
  if (visited.has(file)) return;
  visited.add(file);
  if (file.endsWith(".vue")) {
    // 파일 탐색은 OS 경로를 사용하되 공개 계약의 경로·컴포넌트 이름은 항상 / 기준으로 만든다.
    components.push(relative(resolve(uiRoot, "src"), file).replaceAll("\\", "/"));
    return;
  }
  if (!file.endsWith(".ts")) return;
  const code = await readFile(file, "utf8");
  const syntax = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  for (const node of syntax.statements) {
    if (
      !ts.isExportDeclaration(node) ||
      !node.moduleSpecifier ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue;
    const path = resolve(dirname(file), node.moduleSpecifier.text);
    const candidate = [path, path + ".ts", resolve(path, "index.ts")].find(
      (name) => existsSync(name) && /\.(?:ts|vue)$/.test(name),
    );
    if (candidate) await collectPublicComponents(candidate);
  }
}
// 소스 문서화와 실제 배포 exports의 경계를 각각 검사한다.
const registry = JSON.parse(await readFile(resolve(uiRoot, "source-entries.json"), "utf8"));
if (registry.format !== 1 || !registry.entries || typeof registry.entries !== "object")
  throw new Error("공개 UI source entry registry 형식이 올바르지 않습니다.");
const actualKeys = Object.keys(manifest.exports).sort();
const sourceKeys = Object.keys(registry.entries).sort();
if (JSON.stringify(actualKeys) !== JSON.stringify(sourceKeys))
  throw new Error("공개 UI exports와 source entry registry의 경로가 다릅니다.");
for (const target of Object.values(registry.entries)) {
  if (typeof target !== "string" || !target.startsWith("./src/") || target.includes(".."))
    throw new Error("공개 UI source entry는 패키지 src 내부 파일이어야 합니다.");
  const file = resolve(uiRoot, target);
  if (!existsSync(file)) throw new Error(`공개 UI source entry 파일이 없습니다: ${target}`);
  await collectPublicComponents(file);
}
if (components.length < 22 || new Set(components).size !== components.length)
  throw new Error("공개 UI 계약 22개가 모두 추출되어야 합니다.");
function readableDefault(value) {
  if (value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
const contracts = components.map((file) => {
  const meta = checker.getComponentMeta(
    fileURLToPath(new URL(`frontend/packages/ui/src/${file}`, root)),
  );
  const props = meta.props.filter((prop) => !prop.global);
  if (
    !props.length ||
    props.some((prop) => ["theme", "elevation"].includes(prop.name)) ||
    props.some(
      (prop) =>
        prop.name === "density" &&
        (prop.schema?.kind !== "enum" ||
          JSON.stringify([...prop.schema.schema].sort()) !==
            JSON.stringify(['"compact"', '"comfortable"', "undefined"].sort())),
    )
  ) {
    throw new Error(`${file}: 공개 props 대신 내부 Vuetify 계약이 추출되었습니다.`);
  }
  return {
    component: file.split("/").at(-1).replace(".vue", ""),
    props: props.map((prop) => ({
      name: prop.name,
      required: prop.required,
      type: prop.type,
      defaultSpecified: prop.default !== undefined,
      default: readableDefault(prop.default),
      description: prop.description,
    })),
    events: meta.events.map(({ name, type, description }) => ({ name, type, description })),
    slots: meta.slots.map(({ name, type, description }) => ({ name, type, description })),
  };
});
const content = JSON.stringify({ format: 2, components: contracts }, null, 2) + "\n";
if (checking) {
  // Git의 CRLF checkout만 허용한다. props/events/slots/default 등 실제 계약 차이는 계속 실패한다.
  if ((await readFile(destination, "utf8")).replaceAll("\r\n", "\n") !== content) {
    throw new Error(
      "공개 UI 계약이 변경되었습니다. 문서와 호환성을 검토한 뒤 npm run ui:contracts:generate를 실행하세요.",
    );
  }
  console.log(`공개 UI ${contracts.length}개: imported props/events/slots/default 계약 일치`);
} else {
  await writeFile(destination, content);
  console.log(`공개 UI ${contracts.length}개 계약 생성 완료`);
}
