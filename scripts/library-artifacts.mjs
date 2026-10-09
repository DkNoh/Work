import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import ts from "typescript";

export async function walkFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(target)));
    else if (entry.isFile()) files.push(target);
    else throw new Error(`Library input must be an ordinary file: ${entry.name}`);
  }
  return files.sort();
}

async function exists(target) {
  try {
    return (await fs.stat(target)).isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function normalizeRelativeSpecifier(file, specifier, declarationsRoot) {
  if (!specifier.startsWith(".")) return specifier;
  const absolute = path.resolve(path.dirname(file), specifier);
  const stem = absolute.endsWith(".js") ? absolute.slice(0, -3) : absolute;
  const candidates = [
    stem.endsWith(".d.ts") ? stem : `${stem}.d.ts`,
    path.join(stem, "index.d.ts"),
  ];
  const target = (await Promise.all(candidates.map(exists))).findIndex(Boolean);
  if (target < 0)
    throw new Error(`Dangling declaration import in ${path.basename(file)}: ${specifier}`);
  const resolved = candidates[target];
  if (!resolved.startsWith(`${declarationsRoot}${path.sep}`))
    throw new Error("Declaration escaped its package");
  let relative = path
    .relative(path.dirname(file), resolved)
    .split(path.sep)
    .join("/")
    .replace(/\.d\.ts$/, ".js");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
}

/** import/export/import-type AST만 정규화한다. 주석·업무 문자열을 전역 치환하지 않는다. */
export async function normalizeDeclarations(declarationsRoot) {
  for (const file of await walkFiles(declarationsRoot)) {
    if (!file.endsWith(".d.ts")) continue;
    const source = ts.createSourceFile(
      file,
      await fs.readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const replacements = new Map();
    const collect = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        replacements.set(node.moduleSpecifier.text, null);
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      )
        replacements.set(node.argument.literal.text, null);
      if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteral(node.moduleReference.expression)
      )
        replacements.set(node.moduleReference.expression.text, null);
      ts.forEachChild(node, collect);
    };
    collect(source);
    for (const specifier of replacements.keys())
      replacements.set(
        specifier,
        await normalizeRelativeSpecifier(file, specifier, declarationsRoot),
      );
    const transformer = (context) => {
      const visitor = (originalNode) => {
        // DefineComponent<..., import('./contracts').Type> 같은 중첩 type도 먼저 변환한다.
        const node = ts.visitEachChild(originalNode, visitor, context);
        if (
          ts.isImportDeclaration(node) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        )
          return ts.factory.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            ts.factory.createStringLiteral(replacements.get(node.moduleSpecifier.text)),
            node.attributes,
          );
        if (
          ts.isExportDeclaration(node) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        )
          return ts.factory.updateExportDeclaration(
            node,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            ts.factory.createStringLiteral(replacements.get(node.moduleSpecifier.text)),
            node.attributes,
          );
        if (
          ts.isImportTypeNode(node) &&
          ts.isLiteralTypeNode(node.argument) &&
          ts.isStringLiteral(node.argument.literal)
        )
          return ts.factory.updateImportTypeNode(
            node,
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral(replacements.get(node.argument.literal.text)),
            ),
            node.attributes,
            node.qualifier,
            node.typeArguments,
            node.isTypeOf,
          );
        if (
          ts.isImportEqualsDeclaration(node) &&
          ts.isExternalModuleReference(node.moduleReference) &&
          node.moduleReference.expression &&
          ts.isStringLiteral(node.moduleReference.expression)
        )
          return ts.factory.updateImportEqualsDeclaration(
            node,
            node.modifiers,
            node.isTypeOnly,
            node.name,
            ts.factory.createExternalModuleReference(
              ts.factory.createStringLiteral(
                replacements.get(node.moduleReference.expression.text),
              ),
            ),
          );
        return node;
      };
      return (node) => ts.visitNode(node, visitor);
    };
    const transformed = ts.transform(source, [transformer]);
    try {
      await fs.writeFile(
        file,
        ts
          .createPrinter({ newLine: ts.NewLineKind.LineFeed })
          .printFile(transformed.transformed[0]),
      );
    } finally {
      transformed.dispose();
    }
  }
}

async function resolveVendor(packageDirectory, name) {
  const require = createRequire(path.join(packageDirectory, "package.json"));
  // import-only exports도 실행하거나 private package.json을 import하지 않고 찾는다.
  for (const modulesDirectory of require.resolve.paths(name) ?? []) {
    const directory = path.join(modulesDirectory, name);
    const manifestPath = path.join(directory, "package.json");
    if (await exists(manifestPath)) {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      if (manifest.name === name) return { directory, manifest };
    }
  }
  throw new Error(`Installed vendor manifest not found: ${name}`);
}

export async function writeThirdPartyNotices(packageDirectory, manifest) {
  const direct = { ...manifest.dependencies, ...manifest.peerDependencies };
  const blocks = [
    `${manifest.name} ${manifest.version} — THIRD-PARTY NOTICES\n\nScFramework original code is UNLICENSED. The following notices reproduce the installed direct runtime dependency and peer license texts. Vendor modules remain external; this is not a complete transitive npm license inventory. Installed vendors and their transitive packages retain their own licenses and notices.\n`,
  ];
  for (const [name, expectedVersion] of Object.entries(direct).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const installed = await resolveVendor(packageDirectory, name);
    if (installed.manifest.version !== expectedVersion)
      throw new Error(
        `Installed ${name} ${installed.manifest.version} differs from exact manifest ${expectedVersion}`,
      );
    const files = (await fs.readdir(installed.directory))
      .filter((file) => /^(?:licen[sc]e|copying|notice)(?:[.\-_].*)?$/i.test(file))
      .sort();
    if (!files.length) throw new Error(`Original license text is missing: ${name}`);
    blocks.push(
      `\n===== ${name} ${installed.manifest.version} (${installed.manifest.license}) =====\n`,
    );
    let originalFiles = 0;
    for (const filename of files) {
      const target = path.join(installed.directory, filename);
      if (!(await fs.stat(target)).isFile()) continue;
      const original = await fs.readFile(target, "utf8");
      if (!original.trim()) throw new Error(`Empty vendor notice: ${name}/${filename}`);
      blocks.push(`\n--- ${filename} ---\n${original}${original.endsWith("\n") ? "" : "\n"}`);
      originalFiles += 1;
    }
    if (!originalFiles) throw new Error(`Original license text is missing: ${name}`);
  }
  await fs.writeFile(path.join(packageDirectory, "THIRD_PARTY_NOTICES"), blocks.join(""));
}

/** 절대 경로/생성 시각 없이 실제 생산 source와 build 입력의 digest만 기록한다. */
export async function libraryInputsDigest(packageDirectory) {
  const sources = (await walkFiles(path.join(packageDirectory, "src"))).filter(
    (file) => !file.endsWith(".spec.ts"),
  );
  const inputs = [
    ...sources,
    ...[
      "package.json",
      "tsconfig.build.json",
      "vite.library.config.mjs",
      "source-entries.json",
      "library/styles.ts",
    ].map((file) => path.join(packageDirectory, file)),
    ...["build-library.mjs", "library-artifacts.mjs", "library-config.mjs"].map((file) =>
      path.resolve(packageDirectory, "../../../scripts", file),
    ),
  ];
  const digest = createHash("sha256");
  for (const file of inputs.sort()) {
    if (!(await exists(file))) continue;
    digest.update(path.relative(packageDirectory, file).split(path.sep).join("/"));
    digest.update("\0");
    digest.update(await fs.readFile(file));
    digest.update("\0");
  }
  return digest.digest("hex");
}
