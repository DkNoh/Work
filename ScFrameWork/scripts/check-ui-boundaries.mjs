import { readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

let root = fileURLToPath(new URL("../", import.meta.url));
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument !== "--root" || !process.argv[index + 1])
    throw new Error("사용법: node scripts/check-ui-boundaries.mjs [--root <검사할 프로젝트 경로>]");
  root = resolve(process.argv[++index]);
}
const frontend = resolve(root, "frontend");
const packages = resolve(frontend, "packages");
const apps = resolve(frontend, "apps");
const ignored = new Set([
  "node_modules",
  "dist",
  "storybook-static",
  "test-results",
  "playwright-report",
  "public",
]);
// Windows의 역슬래시와 POSIX의 슬래시를 실제 OS 구분자로 비교한다.
// 단순 문자열 prefix는 ui와 ui-other도 혼동하므로 반드시 디렉터리 경계를 붙인다.
const inside = (file, directory) => file.startsWith(directory + sep);
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map(async (entry) => {
      if (ignored.has(entry.name)) return [];
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(?:vue|ts|js|mjs|scss)$/.test(path) ? [path] : [];
    }),
  );
  return groups.flat();
}
// workspace manifest의 실제 공개 경로를 사용한다. 확장 모듈도 같은 경계를 갖는다.
const sharedModules = new Map();
for (const entry of await readdir(packages, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = resolve(packages, entry.name);
  const manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8"));
  sharedModules.set(manifest.name, {
    directory,
    exports: new Set(
      Object.keys(manifest.exports ?? {}).map((key) =>
        key === "." ? manifest.name : manifest.name + key.slice(1),
      ),
    ),
  });
}
const appNames = new Set();
const appDirectories = new Map();
for (const entry of await readdir(apps, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    const manifest = JSON.parse(await readFile(resolve(apps, entry.name, "package.json"), "utf8"));
    appNames.add(manifest.name);
    appDirectories.set(manifest.name, resolve(apps, entry.name));
  }
}
let checked = 0;
const violations = [];
for (const file of await sourceFiles(frontend)) {
  const text = await readFile(file, "utf8");
  const script = file.endsWith(".vue")
    ? (text.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "")
    : text;
  const syntax = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  for (const match of text.matchAll(/@(?:use|forward)\s+["']([^"']+)["']/g)) imports.push(match[1]);
  for (const specifier of imports) {
    checked += 1;
    const path = specifier.startsWith(".") ? resolve(dirname(file), specifier) : null;
    const shared = inside(file, packages);
    const consumer = inside(file, apps);
    const sharedOwner = [...sharedModules].find(([, module]) =>
      inside(file, module.directory),
    )?.[0];
    const owner = [...appDirectories].find(([, directory]) => inside(file, directory))?.[0];
    if (
      consumer &&
      [...appDirectories].some(
        ([name, directory]) =>
          name !== owner &&
          (specifier === name ||
            specifier.startsWith(name + "/") ||
            path === directory ||
            (path && inside(path, directory))),
      )
    ) {
      violations.push(`${relative(root, file)}: 소비 앱끼리 구현을 참조하지 마세요: ${specifier}`);
    }
    if (
      shared &&
      ([...appNames].some((name) => specifier === name || specifier.startsWith(name + "/")) ||
        (path && inside(path, apps)))
    ) {
      violations.push(`${relative(root, file)}: 공통 패키지가 소비 앱을 참조합니다: ${specifier}`);
    }
    for (const [name, module] of sharedModules) {
      if (
        (consumer || (shared && sharedOwner !== name)) &&
        (((specifier === name || specifier.startsWith(name + "/")) &&
          !module.exports.has(specifier)) ||
          path === module.directory ||
          (path && inside(path, module.directory)))
      ) {
        violations.push(
          `${relative(root, file)}: ${name}의 공개 export를 사용하세요: ${specifier}`,
        );
      }
    }
  }
}
if (violations.length) throw new Error(violations.join("\n"));
console.log(`공개 UI/소비 앱 경계: import ${checked}개 확인`);
