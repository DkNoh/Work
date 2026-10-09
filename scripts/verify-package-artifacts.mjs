import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { builtinModules, createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NAMES = ["@sc/ui", "@sc/runtime", "@sc/date", "@sc/excel", "@sc/i18n"];
const MAVEN_NAMES = [
  "sc-framework-parent",
  "framework-core",
  "framework-autoconfigure",
  "framework-spring-boot-starter",
];
const UI_KEYS = [
  ".",
  "./styles",
  "./tokens",
  "./table",
  "./charts",
  "./editor",
  "./board",
  "./image",
];
const ALLOW_FILES = ["dist", "README.md", "UNLICENSED", "THIRD_PARTY_NOTICES"];
const MAX_ARCHIVE = 128 * 1024 * 1024;
const MAX_FILE = 32 * 1024 * 1024;
const builtins = new Set(builtinModules.flatMap((name) => [name, "node:" + name]));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const normalizeText = (text) => text.replace(/\s+/g, " ").trim();

export class PackageArtifactError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "PackageArtifactError";
    this.code = code;
    this.temporaryDirectoryRemoved = true;
  }
}

function requireThat(condition, code, message) {
  if (!condition) throw new PackageArtifactError(code, message);
}

function json(bytes, code) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new PackageArtifactError(code, "A required JSON document is invalid");
  }
}

function safeRelative(name, code = "SC_PACKAGE_PATH") {
  requireThat(
    typeof name === "string" &&
      name.length > 0 &&
      name.length <= 512 &&
      ![...name].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 || character === "\\",
      ) &&
      !path.posix.isAbsolute(name) &&
      !/^[A-Za-z]:/.test(name),
    code,
    "An artifact path is unsafe",
  );
  const parts = name.replace(/\/$/, "").split("/");
  requireThat(
    parts.every((part) => part && part !== "." && part !== ".."),
    code,
    "An artifact path escapes its allowed root",
  );
  return parts.join("/");
}

async function safeFile(root, relative) {
  const clean = safeRelative(relative);
  let current = root;
  for (const part of clean.split("/")) {
    current = path.join(current, part);
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch {
      throw new PackageArtifactError(
        "SC_ARTIFACT_FILE_MISSING",
        "A manifest artifact file is missing",
      );
    }
    requireThat(
      !stat.isSymbolicLink(),
      "SC_ARTIFACT_SYMLINK",
      "Artifact paths must not contain symlinks",
    );
  }
  const stat = await fs.lstat(current);
  requireThat(
    stat.isFile() && stat.size > 0 && stat.size <= MAX_ARCHIVE,
    "SC_ARTIFACT_FILE_TYPE",
    "An artifact must be a nonempty bounded regular file",
  );
  return fs.readFile(current);
}

function tarString(block, start, length) {
  const value = block.subarray(start, start + length);
  const end = value.indexOf(0);
  return value.subarray(0, end < 0 ? value.length : end).toString("utf8");
}

function tarNumber(block, start, length) {
  const value = tarString(block, start, length).trim();
  requireThat(
    value === "" || /^[0-7]+$/.test(value),
    "SC_TAR_NUMBER",
    "An archive numeric field is invalid",
  );
  const result = value === "" ? 0 : Number.parseInt(value, 8);
  requireThat(
    Number.isSafeInteger(result) && result >= 0,
    "SC_TAR_NUMBER",
    "An archive numeric field is out of range",
  );
  return result;
}

function paxRecords(bytes) {
  const result = {};
  let index = 0;
  while (index < bytes.length) {
    const space = bytes.indexOf(32, index);
    requireThat(space > index, "SC_TAR_PAX", "An archive extended header is invalid");
    const number = bytes.subarray(index, space).toString("ascii");
    requireThat(/^\d+$/.test(number), "SC_TAR_PAX", "An archive extended header length is invalid");
    const size = Number(number);
    requireThat(
      size > space - index + 2 && index + size <= bytes.length && bytes[index + size - 1] === 10,
      "SC_TAR_PAX",
      "An archive extended header exceeds its bounds",
    );
    const record = bytes.subarray(space + 1, index + size - 1).toString("utf8");
    const equals = record.indexOf("=");
    requireThat(equals > 0, "SC_TAR_PAX", "An archive extended header key is invalid");
    const key = record.slice(0, equals);
    requireThat(
      !["__proto__", "prototype", "constructor"].includes(key),
      "SC_TAR_PAX",
      "An archive extended header key is forbidden",
    );
    result[key] = record.slice(equals + 1);
    index += size;
  }
  return result;
}

/** 압축과 tar header를 먼저 검사한 뒤 안전한 일반 파일만 임시 root에 쓴다. */
async function unpackTarball(bytes, destination) {
  let tar;
  try {
    tar = gunzipSync(bytes, { maxOutputLength: MAX_ARCHIVE });
  } catch {
    throw new PackageArtifactError(
      "SC_TAR_GZIP",
      "An archive is invalid or exceeds its decompression limit",
    );
  }
  const files = new Map();
  const seenPaths = new Set();
  let extended = {};
  let longName = null;
  let offset = 0;
  let ended = false;
  while (offset + 512 <= tar.length) {
    const block = tar.subarray(offset, offset + 512);
    if (block.every((value) => value === 0)) {
      requireThat(
        tar.subarray(offset).every((value) => value === 0),
        "SC_TAR_TRAILER",
        "An archive has unexpected trailing data",
      );
      ended = true;
      break;
    }
    const expected = tarNumber(block, 148, 8);
    const actual = block.reduce(
      (sum, value, index) => sum + (index >= 148 && index < 156 ? 32 : value),
      0,
    );
    requireThat(actual === expected, "SC_TAR_CHECKSUM", "An archive header checksum is invalid");
    const type = tarString(block, 156, 1) || "0";
    const rawSize = tarNumber(block, 124, 12);
    requireThat(
      rawSize <= MAX_FILE && offset + 512 + rawSize <= tar.length,
      "SC_TAR_SIZE",
      "An archive entry exceeds its bounds",
    );
    const body = tar.subarray(offset + 512, offset + 512 + rawSize);
    offset += 512 + Math.ceil(rawSize / 512) * 512;
    if (type === "x") {
      extended = paxRecords(body);
      continue;
    }
    requireThat(type !== "g", "SC_TAR_PAX_GLOBAL", "Global archive overrides are not supported");
    if (type === "L") {
      longName = body.toString("utf8").replace(/\0.*$/s, "").replace(/\n$/, "");
      continue;
    }
    requireThat(
      !["1", "2", "K"].includes(type) && !extended.linkpath,
      "SC_TAR_LINK",
      "Symlinks and hardlinks are forbidden in npm artifacts",
    );
    requireThat(
      type === "0" || type === "5",
      "SC_TAR_TYPE",
      "Only regular files and directories are allowed in npm artifacts",
    );
    requireThat(
      !extended.size || Number(extended.size) === rawSize,
      "SC_TAR_PAX_SIZE",
      "An archive size override is inconsistent",
    );
    const prefix = tarString(block, 345, 155);
    const name = safeRelative(
      extended.path ?? longName ?? (prefix ? prefix + "/" : "") + tarString(block, 0, 100),
      "SC_TAR_PATH",
    );
    extended = {};
    longName = null;
    requireThat(
      name === "package" || name.startsWith("package/"),
      "SC_TAR_ROOT",
      "An npm archive entry is outside package/",
    );
    requireThat(
      !seenPaths.has(name),
      "SC_TAR_DUPLICATE",
      "An archive contains duplicate entry paths",
    );
    seenPaths.add(name);
    if (type === "5") {
      requireThat(
        rawSize === 0,
        "SC_TAR_DIRECTORY",
        "An archive directory contains unexpected data",
      );
      continue;
    }
    requireThat(name !== "package", "SC_TAR_ROOT", "The npm package root is not a regular file");
    files.set(name.slice(8), body);
  }
  requireThat(
    ended && Object.keys(extended).length === 0 && longName === null && files.size > 0,
    "SC_TAR_EMPTY",
    "An npm archive is empty or incomplete",
  );
  for (const [name, body] of files) {
    const file = path.join(destination, name);
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body, { flag: "wx", mode: 0o600 });
    } catch {
      throw new PackageArtifactError("SC_TAR_COLLISION", "Archive file/directory paths collide");
    }
  }
  return files;
}

function packageName(specifier) {
  return specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0];
}

function metadataFor(name, manifestFile) {
  const require = createRequire(manifestFile);
  for (const folder of require.resolve.paths(name) ?? []) {
    const file = path.join(folder, name, "package.json");
    if (existsSync(file)) {
      const actual = realpathSync(file);
      const metadata = JSON.parse(readFileSync(actual, "utf8"));
      if (metadata.name === name) return { file: actual, metadata };
    }
  }
  throw new PackageArtifactError(
    "SC_VENDOR_MISSING",
    "A declared vendor or peer is not installed at its package-local resolution",
  );
}

function pickExport(value, conditions, wildcard = "") {
  if (typeof value === "string") return value.replaceAll("*", wildcard);
  if (Array.isArray(value))
    return value.map((item) => pickExport(item, conditions, wildcard)).find(Boolean);
  if (value && typeof value === "object") {
    for (const [condition, target] of Object.entries(value))
      if (conditions.has(condition)) {
        const resolved = pickExport(target, conditions, wildcard);
        if (resolved) return resolved;
      }
  }
  return null;
}

function vendorSubpathExists(specifier, vendor, declaration) {
  const name = vendor.metadata.name;
  const subpath = specifier === name ? "." : "." + specifier.slice(name.length);
  const exported = vendor.metadata.exports;
  const conditions = new Set(
    declaration
      ? ["types", "import", "default", "browser", "node"]
      : ["import", "default", "browser", "node"],
  );
  if (exported) {
    let value;
    let wildcard = "";
    if (
      typeof exported === "string" ||
      Array.isArray(exported) ||
      !Object.keys(exported).some((key) => key.startsWith("."))
    )
      value = subpath === "." ? exported : null;
    else {
      value = exported[subpath];
      if (value === undefined)
        for (const [key, target] of Object.entries(exported)) {
          if (!key.includes("*")) continue;
          const [start, end] = key.split("*");
          if (subpath.startsWith(start) && subpath.endsWith(end)) {
            value = target;
            wildcard = subpath.slice(start.length, subpath.length - end.length);
            break;
          }
        }
    }
    const target = pickExport(value, conditions, wildcard);
    return (
      typeof target === "string" &&
      target.startsWith("./") &&
      existsSync(path.join(path.dirname(vendor.file), target))
    );
  }
  if (subpath === ".")
    return Boolean(
      vendor.metadata.main ||
      vendor.metadata.module ||
      vendor.metadata.types ||
      existsSync(path.join(path.dirname(vendor.file), "index.js")),
    );
  const base = path.join(path.dirname(vendor.file), subpath.slice(2));
  return [
    base,
    base + ".js",
    base + ".mjs",
    base + ".cjs",
    base + ".d.ts",
    path.join(base, "index.js"),
    path.join(base, "index.d.ts"),
  ].some(existsSync);
}

function relativeTarget(files, importer, specifier, declaration) {
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  requireThat(
    target.startsWith("dist/") && !target.includes("\\"),
    "SC_PACKAGE_RELATIVE_ESCAPE",
    "A module reference leaves its packaged dist boundary",
  );
  const candidates =
    declaration && /\.(?:mjs|cjs|js)$/.test(target)
      ? [
          target
            .replace(/\.mjs$/, ".d.mts")
            .replace(/\.cjs$/, ".d.cts")
            .replace(/\.js$/, ".d.ts"),
        ]
      : [target];
  const resolved = candidates.find((candidate) => files.has(candidate));
  requireThat(
    Boolean(resolved),
    declaration ? "SC_DECL_RELATIVE_MISSING" : "SC_JS_RELATIVE_MISSING",
    "A relative module reference has no packaged target",
  );
  return resolved;
}

function moduleReferences(source, file) {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  requireThat(
    ast.parseDiagnostics.length === 0,
    "SC_MODULE_SYNTAX",
    "A packaged JS/declaration file has invalid syntax",
  );
  const references = [];
  const exportedNames = new Set();
  const valueExportedNames = new Set();
  const starExports = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      references.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      requireThat(
        node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0]),
        "SC_MODULE_DYNAMIC",
        "Dynamic module references must use a literal specifier",
      );
      references.push(node.arguments[0].text);
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    )
      references.push(node.argument.literal.text);
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    )
      references.push(node.moduleReference.expression.text);
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause))
      for (const item of node.exportClause.elements) {
        exportedNames.add(item.name.text);
        if (!node.isTypeOnly && !item.isTypeOnly) valueExportedNames.add(item.name.text);
      }
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause &&
      ts.isNamespaceExport(node.exportClause)
    ) {
      exportedNames.add(node.exportClause.name.text);
      if (!node.isTypeOnly) valueExportedNames.add(node.exportClause.name.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      !node.exportClause &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      starExports.push({ specifier: node.moduleSpecifier.text, typeOnly: node.isTypeOnly });
    if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if (node.name && ts.isIdentifier(node.name)) {
        exportedNames.add(node.name.text);
        if (!ts.isInterfaceDeclaration(node) && !ts.isTypeAliasDeclaration(node))
          valueExportedNames.add(node.name.text);
      }
      if (ts.isVariableStatement(node))
        for (const item of node.declarationList.declarations)
          if (ts.isIdentifier(item.name)) {
            exportedNames.add(item.name.text);
            valueExportedNames.add(item.name.text);
          }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const item of ast.referencedFiles) references.push(item.fileName);
  for (const item of ast.typeReferenceDirectives)
    references.push(
      item.fileName.startsWith("@types/") ? item.fileName : "@types/" + item.fileName,
    );
  return { references: [...new Set(references)], exportedNames, valueExportedNames, starExports };
}

function exportTarget(value, condition) {
  return typeof value === "string" ? value : value?.[condition];
}

async function validatePackage(name, item, files) {
  requireThat(
    files.has("package.json"),
    "SC_PACKAGE_MANIFEST",
    "An npm archive lacks package.json",
  );
  const manifest = json(files.get("package.json"), "SC_PACKAGE_MANIFEST");
  requireThat(
    manifest.name === name && manifest.version === item.version && manifest.type === "module",
    "SC_PACKAGE_IDENTITY",
    "Compiled package identity/version/module type does not match its artifact manifest",
  );
  requireThat(
    manifest.private === true && manifest.license === "UNLICENSED",
    "SC_PACKAGE_LICENSE",
    "Internal package private/UNLICENSED policy is missing",
  );
  requireThat(
    files.has("dist/build-manifest.json"),
    "SC_PACKAGE_BUILD_STAMP",
    "A compiled package must include its producer build stamp",
  );
  const stamp = json(files.get("dist/build-manifest.json"), "SC_PACKAGE_BUILD_STAMP");
  requireThat(
    stamp.format === 1 &&
      stamp.name === name &&
      stamp.version === item.version &&
      /^[0-9a-f]{64}$/.test(stamp.inputsDigest ?? ""),
    "SC_PACKAGE_BUILD_STAMP",
    "The producer stamp identity/version/input digest is invalid",
  );
  requireThat(
    Array.isArray(manifest.files) &&
      JSON.stringify([...manifest.files].sort()) === JSON.stringify([...ALLOW_FILES].sort()),
    "SC_PACKAGE_FILES",
    "The compiled package files allowlist differs from its contract",
  );
  requireThat(
    !Object.keys(manifest.scripts ?? {}).some((key) =>
      ["preinstall", "install", "postinstall", "prepare"].includes(key),
    ),
    "SC_PACKAGE_LIFECYCLE",
    "Consumer install must not rebuild missing library source",
  );
  for (const file of files.keys()) {
    const parts = file.toLowerCase().split("/");
    requireThat(
      !parts.some((part) =>
        [
          "src",
          "source",
          "tests",
          "test",
          "__tests__",
          "stories",
          "fixtures",
          "reference-app",
          "starter-app",
          "apps",
          "backend",
          ".runtime",
          "node_modules",
          ".git",
          "secrets",
          "uploads",
        ].includes(part),
      ) &&
        !/(?:\.spec\.|\.test\.|\.stories\.|\.map$|\.vue$|\.(?:tsx?|mts|cts)$|\.tgz$|\.jar$|\.war$|\.db$|\.sqlite\d?$|\.secret$|\.pem$|\.p12$|\.key$|(?:^|\/)\.env(?:\.|$)|(?:^|\/)source-entries\.json$)/i.test(
          file.replace(/\.d\.(?:ts|mts|cts)$/, ".declaration"),
        ),
      "SC_PACKAGE_FORBIDDEN_FILE",
      "Source/tests/stories/maps/business/runtime/secret/database files must not be packed",
    );
    requireThat(
      file === "package.json" || ALLOW_FILES.slice(1).includes(file) || file.startsWith("dist/"),
      "SC_PACKAGE_FILE_SCOPE",
      "An npm archive contains a file outside its public delivery allowlist",
    );
    if (/\.(?:js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/.test(file)) {
      const text = files.get(file).toString("utf8");
      requireThat(
        !/sourceMappingURL\s*=/.test(text),
        "SC_PACKAGE_MAP_REFERENCE",
        "Source/declaration map references are not distributed",
      );
      requireThat(
        !/\b(?:RequirementDetail|RequirementReportItem|RequirementReportPage|KanbanTaskResponse|ReferenceIdentity|ScreenVersionEntity)\b/.test(
          text,
        ),
        "SC_PACKAGE_BUSINESS_TYPE",
        "Reference business DTO/entity names must not enter neutral compiled packages",
      );
    }
  }
  for (const file of ALLOW_FILES.slice(1))
    requireThat(
      files.has(file) && files.get(file).length > 20,
      "SC_PACKAGE_NOTICE",
      "README/internal license/third-party notices must be included and nonempty",
    );
  const expectedKeys = name === "@sc/ui" ? UI_KEYS : ["."];
  requireThat(
    manifest.exports &&
      JSON.stringify(Object.keys(manifest.exports).sort()) ===
        JSON.stringify([...expectedKeys].sort()),
    "SC_PACKAGE_PRIVATE_EXPORT",
    "Public export keys are missing or expose private source/dist entry points",
  );
  requireThat(
    manifest.types === "./dist/types/index.d.ts",
    "SC_PACKAGE_TYPES",
    "The package root types entry must address its compiled declaration",
  );
  const exportsReport = [];
  for (const key of expectedKeys) {
    const value = manifest.exports[key];
    const targets = typeof value === "string" ? [value] : Object.values(value ?? {});
    requireThat(
      targets.length > 0 &&
        targets.every(
          (target) =>
            typeof target === "string" && target.startsWith("./dist/") && !target.includes("*"),
        ),
      "SC_PACKAGE_EXPORT_TARGET",
      "Exports must use concrete compiled dist targets",
    );
    for (const target of targets)
      requireThat(
        files.has(target.slice(2)),
        key === "./styles" ? "SC_UI_CSS_MISSING" : "SC_PACKAGE_EXPORT_MISSING",
        "A public export target is absent from its tarball",
      );
    if (key !== "./styles" && key !== "./tokens") {
      const stem = key === "." ? "index" : key.slice(2);
      requireThat(
        exportTarget(value, "types") ===
          `./dist/types/${stem === "index" ? "index" : stem + "/index"}.d.ts` &&
          exportTarget(value, "import") === `./dist/${stem}.js` &&
          exportTarget(value, "default") === `./dist/${stem}.js` &&
          JSON.stringify(Object.keys(value).sort()) ===
            JSON.stringify(["default", "import", "types"]) &&
          Object.keys(value)[0] === "types",
        "SC_PACKAGE_EXPORT_SHAPE",
        "Public JS/types export conditions differ from the compiled contract",
      );
    }
    exportsReport.push({ key, targets });
  }
  const sourceManifest = path.join(ROOT, "frontend/packages", name.slice(4), "package.json");
  const declarations = {
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  };
  const vendorReport = [];
  const vendorMap = new Map();
  const notice = normalizeText(files.get("THIRD_PARTY_NOTICES").toString("utf8"));
  for (const [vendorName, version] of Object.entries(declarations)) {
    requireThat(
      /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version),
      "SC_VENDOR_EXACT_VERSION",
      "Direct vendor and peer versions must remain exact",
    );
    const vendor = metadataFor(vendorName, sourceManifest);
    requireThat(
      vendor.metadata.version === version && typeof vendor.metadata.license === "string",
      "SC_VENDOR_VERSION_LICENSE",
      "Package-local vendor version/license does not match the compiled manifest",
    );
    vendorMap.set(vendorName, vendor);
    requireThat(
      notice.includes(vendorName) &&
        notice.includes(version) &&
        notice.includes(vendor.metadata.license),
      "SC_VENDOR_NOTICE_METADATA",
      "Third-party notices omit a direct vendor's actual metadata",
    );
    const entries = await fs.readdir(path.dirname(vendor.file));
    const licenseFiles = entries.filter((entry) =>
      /^(?:LICEN[CS]E(?:[._-].*)?|COPYING(?:[._-].*)?|NOTICE(?:[._-].*)?)$/i.test(entry),
    );
    requireThat(
      licenseFiles.length > 0,
      "SC_VENDOR_LICENSE_FILE",
      "An installed direct vendor's original rights text was not found",
    );
    let regularLicenseCount = 0;
    for (const entry of licenseFiles) {
      const licensePath = path.join(path.dirname(vendor.file), entry);
      if (!(await fs.stat(licensePath)).isFile()) continue;
      regularLicenseCount++;
      const original = normalizeText(await fs.readFile(licensePath, "utf8"));
      requireThat(
        original.length > 0 && notice.includes(original),
        "SC_VENDOR_NOTICE_TEXT",
        "A direct vendor's original LICENSE/COPYING/NOTICE text is missing",
      );
    }
    requireThat(
      regularLicenseCount > 0,
      "SC_VENDOR_LICENSE_FILE",
      "Direct vendor rights entries must contain a regular text file",
    );
    vendorReport.push({
      name: vendorName,
      version,
      license: vendor.metadata.license,
      metadataPath: path.relative(ROOT, vendor.file).split(path.sep).join("/"),
      licenseFiles,
    });
  }
  function checkReference(specifier, importer, declaration) {
    requireThat(
      !/^(?:[A-Za-z]:|\/|\\|file:|https?:|#|@\/|~\/)/.test(specifier) &&
        !/^(?:@sc\/[\w-]+\/(?:src|dist|source)|\.\.\/.*frontend\/packages)/.test(specifier),
      declaration ? "SC_DECL_ABSOLUTE_ALIAS" : "SC_JS_ABSOLUTE_ALIAS",
      "Module references must not expose absolute paths/workspace source aliases",
    );
    if (specifier.startsWith(".")) {
      requireThat(
        /\.(?:js|mjs|cjs|d\.ts|d\.mts|d\.cts|css)$/.test(specifier),
        declaration ? "SC_DECL_EXTENSION" : "SC_JS_EXTENSION",
        "Relative module references need a delivered extension",
      );
      return relativeTarget(files, importer, specifier, declaration);
    }
    if (builtins.has(specifier)) {
      requireThat(
        name !== "@sc/ui",
        "SC_UI_NODE_BUILTIN",
        "Browser UI must not import a Node builtin",
      );
      return null;
    }
    const vendorName = packageName(specifier);
    requireThat(
      Object.hasOwn(declarations, vendorName),
      declaration ? "SC_DECL_UNDECLARED_BARE" : "SC_JS_UNDECLARED_BARE",
      "A bare module reference is not declared as dependency or peer",
    );
    requireThat(
      vendorSubpathExists(specifier, vendorMap.get(vendorName), declaration),
      declaration ? "SC_DECL_VENDOR_SUBPATH" : "SC_JS_VENDOR_SUBPATH",
      "A vendor subpath is not available through its installed package contract",
    );
    return null;
  }
  let moduleCount = 0;
  let declarationCount = 0;
  let referenceCount = 0;
  const named = new Map();
  const exportRecords = new Map();
  for (const [file, bytes] of files) {
    const declaration = /\.d\.(?:ts|mts|cts)$/.test(file);
    if (!declaration && !/\.(?:js|mjs|cjs)$/.test(file)) continue;
    const result = moduleReferences(bytes.toString("utf8"), file);
    exportRecords.set(file, { ...result, declaration });
    for (const specifier of result.references) {
      try {
        checkReference(specifier, file, declaration);
      } catch (error) {
        if (error instanceof PackageArtifactError)
          error.context = {
            package: name,
            file,
            referenceKind: specifier.startsWith(".") ? "relative" : "bare-or-absolute",
          };
        throw error;
      }
      referenceCount++;
    }
    if (declaration) declarationCount++;
    else moduleCount++;
  }
  function namesFor(file, valuesOnly, visited = new Set()) {
    const record = exportRecords.get(file);
    if (!record) return new Set();
    const result = new Set(valuesOnly ? record.valueExportedNames : record.exportedNames);
    if (visited.has(file)) return result;
    const nextVisited = new Set([...visited, file]);
    for (const entry of record.starExports) {
      if (!entry.specifier.startsWith(".") || (valuesOnly && entry.typeOnly)) continue;
      const target = relativeTarget(files, file, entry.specifier, record.declaration);
      for (const exportedName of namesFor(target, valuesOnly, nextVisited))
        if (exportedName !== "default") result.add(exportedName);
    }
    return result;
  }
  for (const file of exportRecords.keys()) named.set(file, namesFor(file, false));
  requireThat(
    moduleCount > 0 &&
      declarationCount > 0 &&
      named.get("dist/index.js")?.size > 0 &&
      named.get("dist/types/index.d.ts")?.size > 0,
    "SC_PACKAGE_EMPTY_MODULE",
    "Empty JS/declaration exports are not a completed package",
  );
  if (name === "@sc/runtime")
    requireThat(
      files.has("dist/types/generated/api.d.ts") &&
        files.get("dist/types/generated/api.d.ts").length > 100,
      "SC_RUNTIME_NEUTRAL_TYPES",
      "Neutral API compatibility declarations must be delivered",
    );
  if (name === "@sc/ui") {
    requireThat(
      Array.isArray(manifest.sideEffects) &&
        manifest.sideEffects.some((entry) => entry.endsWith("*.css")) &&
        manifest.sideEffects.some((entry) => entry.endsWith("*.scss")),
      "SC_UI_STYLE_SIDE_EFFECT",
      "Public CSS/SCSS must retain their package side effects",
    );
    requireThat(
      exportTarget(manifest.exports["./styles"], "default") === "./dist/sc-ui.css" &&
        exportTarget(manifest.exports["./styles"], "types") === "./dist/types/styles.d.ts" &&
        exportTarget(manifest.exports["./tokens"], "sass") === "./dist/tokens.scss" &&
        exportTarget(manifest.exports["./tokens"], "default") === "./dist/tokens.scss",
      "SC_UI_STYLE_EXPORT",
      "UI CSS/Sass public exports differ from their contract",
    );
    requireThat(
      files.has("dist/sc-ui.css") &&
        files.get("dist/sc-ui.css").length > 100 &&
        /\.sc-[\w-]+/.test(files.get("dist/sc-ui.css").toString("utf8")) &&
        /--sc-[\w-]+/.test(files.get("dist/sc-ui.css").toString("utf8")),
      "SC_UI_CSS_MISSING",
      "UI public CSS lacks actual common selectors/tokens",
    );
    const sass = files.get("dist/tokens.scss")?.toString("utf8") ?? "";
    requireThat(
      /\$sc-emit-css:\s*true\s*!default/.test(sass) && /\$sc-breakpoint-sm:\s*768px/.test(sass),
      "SC_UI_SASS_TOKENS",
      "Public Sass must preserve the generated breakpoint/emission contract",
    );
    requireThat(
      files.has("dist/CONTRACTS.json"),
      "SC_UI_CONTRACTS_MISSING",
      "The UI public contracts snapshot must be included",
    );
    const contracts = json(files.get("dist/CONTRACTS.json"), "SC_UI_CONTRACTS_INVALID");
    const expected = JSON.parse(readFileSync(path.join(ROOT, "docs/ui-contracts.json"), "utf8"));
    requireThat(
      contracts.format === 2 &&
        Array.isArray(contracts.components) &&
        expected.format === 2 &&
        Array.isArray(expected.components) &&
        expected.components.length >= 22 &&
        contracts.components.length === expected.components.length,
      "SC_UI_CONTRACTS_EMPTY",
      "The UI snapshot must describe every component in the current public source contract",
    );
    try {
      assert.deepEqual(contracts, expected);
    } catch {
      throw new PackageArtifactError(
        "SC_UI_CONTRACTS_DRIFT",
        "The compiled UI contracts differ from the current public source snapshot",
      );
    }
    const groups = {
      ScDataTable: "table",
      ScVirtualTable: "table",
      ScVirtualList: "table",
      ScChart: "charts",
      ScSeriesChart: "charts",
      ScRichTextEditor: "editor",
      ScSortableBoard: "board",
      ScImageAnnotator: "image",
    };
    for (const component of contracts.components) {
      const stem = groups[component.component] ?? "index";
      requireThat(
        namesFor(`dist/${stem}.js`, true).has(component.component) &&
          namesFor(`dist/types/${stem === "index" ? "index" : stem + "/index"}.d.ts`, true).has(
            component.component,
          ),
        "SC_UI_COMPONENT_EXPORT",
        "A public UI component is missing from its JS or declaration entry",
      );
    }
  }
  if (name === "@sc/date")
    requireThat(
      manifest.sideEffects !== false,
      "SC_DATE_SIDE_EFFECT",
      "Day.js locale/plugin registration must not be marked universally side-effect free",
    );
  for (const [file, bytes] of files)
    if (/\.(?:css|scss)$/.test(file)) {
      const source = bytes.toString("utf8");
      for (const match of source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
        const target = match[1];
        if (/^(?:data:|#)/.test(target)) continue;
        requireThat(
          !/^(?:https?:|\/|file:)/.test(target),
          "SC_UI_EXTERNAL_ASSET",
          "Compiled styles must not fetch an untracked external asset",
        );
        relativeTarget(files, file, target.split(/[?#]/)[0], false);
      }
      for (const match of source.matchAll(/@(import|use|forward)\s+["']([^"']+)["']/g))
        checkReference(match[2], file, false);
    }
  return {
    name,
    version: manifest.version,
    file: item.file,
    sha256: item.sha256,
    buildStamp: stamp,
    currentSourceDigestCompared: false,
    files: [...files].map(([file, bytes]) => ({ file, bytes: bytes.length, sha256: sha(bytes) })),
    exports: exportsReport,
    modules: moduleCount,
    declarations: declarationCount,
    moduleReferences: referenceCount,
    vendors: vendorReport,
    license: manifest.license,
    private: manifest.private,
    sourceMaps: 0,
    referenceBusinessFiles: 0,
  };
}

async function validateReportPath(reportFile, artifactRoot) {
  const target = path.resolve(reportFile);
  let parent = path.dirname(target);
  const absentParts = [];
  while (!existsSync(parent)) {
    absentParts.unshift(path.basename(parent));
    parent = path.dirname(parent);
  }
  const canonicalTarget = path.join(
    await fs.realpath(parent),
    ...absentParts,
    path.basename(target),
  );
  const artifacts = await fs
    .realpath(path.resolve(artifactRoot))
    .catch(() => path.resolve(artifactRoot));
  const allowedEvidence = path.join(ROOT, "docs/검증");
  requireThat(
    canonicalTarget.endsWith(".json") &&
      canonicalTarget !== artifacts &&
      !canonicalTarget.startsWith(artifacts + path.sep) &&
      (canonicalTarget.startsWith(allowedEvidence + path.sep) ||
        !canonicalTarget.startsWith(ROOT + path.sep)),
    "SC_PACKAGE_REPORT_PATH",
    "Report output must not overwrite artifact or source inputs",
  );
  const stat = await fs.lstat(target).catch(() => null);
  requireThat(
    !stat || (stat.isFile() && !stat.isSymbolicLink()),
    "SC_PACKAGE_REPORT_PATH",
    "Report output must be a regular JSON file",
  );
  return canonicalTarget;
}

/** 발행한 cohort의 template ABI만 선택한다. 미래 minor를 임의로 최신 template에 연결하지 않는다. */
export function expectedTemplateVersion(frameworkVersion) {
  if (typeof frameworkVersion !== "string" || !/^0\.(?:1|2|3)\.\d+$/.test(frameworkVersion))
    return null;
  return frameworkVersion.split(".")[1] === "3" ? 2 : 1;
}

/** 생성기와 CLI가 같은 manifest/tar 검사 경계를 사용한다. 패키지 코드는 실행하지 않는다. */
export async function verifyArtifactDirectory(artifactRoot) {
  const requested = path.resolve(artifactRoot);
  const stat = await fs.lstat(requested).catch(() => null);
  requireThat(
    stat?.isDirectory() && !stat.isSymbolicLink(),
    "SC_ARTIFACT_ROOT",
    "The artifact root must be an existing real directory",
  );
  const root = await fs.realpath(requested);
  const manifestBytes = await safeFile(root, "artifacts.json");
  const manifest = json(manifestBytes, "SC_ARTIFACT_MANIFEST");
  requireThat(
    manifest.format === 1 && /^\d+\.\d+\.\d+$/.test(manifest.frameworkVersion ?? ""),
    "SC_ARTIFACT_FORMAT",
    "The artifact manifest format/template/version is unsupported",
  );
  requireThat(
    expectedTemplateVersion(manifest.frameworkVersion) !== null &&
      manifest.templateVersion === expectedTemplateVersion(manifest.frameworkVersion),
    "SC_ARTIFACT_TEMPLATE_VERSION",
    "The artifact cohort and template ABI selection differ",
  );
  requireThat(
    Array.isArray(manifest.frontend) &&
      manifest.frontend.length === 5 &&
      manifest.frontend.every((item) => item && typeof item === "object") &&
      new Set(manifest.frontend.map((item) => item.name)).size === 5 &&
      NAMES.every((name) => manifest.frontend.some((item) => item.name === name)),
    "SC_ARTIFACT_FRONTEND_COUNT",
    "Exactly five named frontend package artifacts are required",
  );
  requireThat(
    manifest.backend?.repository === "maven" &&
      manifest.backend.version === manifest.frameworkVersion + "-SNAPSHOT" &&
      Array.isArray(manifest.backend.artifacts) &&
      JSON.stringify([...manifest.backend.artifacts].sort()) ===
        JSON.stringify([...MAVEN_NAMES].sort()) &&
      Array.isArray(manifest.backend.files) &&
      manifest.backend.files.length === 7 &&
      manifest.backend.files.every(
        (item) => item && typeof item === "object" && typeof item.file === "string",
      ),
    "SC_ARTIFACT_BACKEND_SHAPE",
    "Four Maven coordinates with four POMs/three plain JARs are required",
  );
  requireThat(
    manifest.toolchain?.node === "24.16.0" &&
      manifest.toolchain.npm === "11.13.0" &&
      manifest.toolchain.java === "21" &&
      manifest.toolchain.springBoot === "3.5.16",
    "SC_ARTIFACT_TOOLCHAIN",
    "The artifact toolchain differs from its current tested contract",
  );
  const report = {
    stage: "011",
    passed: false,
    format: 1,
    frameworkVersion: manifest.frameworkVersion,
    manifestSha256: sha(manifestBytes),
    frontend: [],
    backend: [],
    packageCodeExecuted: false,
    consumerOrSsrVerified: false,
    temporaryDirectoryRemoved: false,
  };
  let temporary;
  let caughtError;
  try {
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), "sc-package-artifacts-"));
    const seen = new Set();
    for (const name of NAMES) {
      const item = manifest.frontend.find((entry) => entry.name === name);
      requireThat(
        item.version === manifest.frameworkVersion &&
          item.file === name.slice(1).replace("/", "-") + "-" + item.version + ".tgz" &&
          /^[0-9a-f]{64}$/.test(item.sha256 ?? "") &&
          !seen.has(item.file),
        "SC_ARTIFACT_FRONTEND_ENTRY",
        "A frontend artifact name/version/hash is inconsistent",
      );
      seen.add(item.file);
      const bytes = await safeFile(root, item.file);
      requireThat(
        sha(bytes) === item.sha256,
        "SC_ARTIFACT_HASH",
        "An artifact hash does not match its immutable manifest",
      );
      const folder = path.join(temporary, name.slice(4));
      await fs.mkdir(folder);
      try {
        const files = await unpackTarball(bytes, folder);
        report.frontend.push(await validatePackage(name, item, files));
      } catch (error) {
        if (error instanceof PackageArtifactError && !error.context)
          error.context = { package: name };
        throw error;
      }
    }
    const backendExpected = MAVEN_NAMES.flatMap((name) =>
      (name === "sc-framework-parent" ? ["pom"] : ["pom", "jar"]).map(
        (extension) =>
          `maven/dev/scframework/${name}/${manifest.backend.version}/${name}-${manifest.backend.version}.${extension}`,
      ),
    );
    requireThat(
      new Set(manifest.backend.files.map((item) => item.file)).size === 7 &&
        backendExpected.every((file) => manifest.backend.files.some((item) => item.file === file)),
      "SC_ARTIFACT_BACKEND_PATHS",
      "Maven artifact paths do not match the four declared coordinates",
    );
    for (const item of manifest.backend.files) {
      requireThat(
        /^[0-9a-f]{64}$/.test(item.sha256 ?? ""),
        "SC_ARTIFACT_HASH_FORMAT",
        "A Maven artifact hash is invalid",
      );
      const bytes = await safeFile(root, item.file);
      requireThat(
        sha(bytes) === item.sha256,
        "SC_ARTIFACT_HASH",
        "A Maven artifact hash does not match its manifest",
      );
      requireThat(
        item.file.endsWith(".pom")
          ? /<project[\s>]/.test(bytes.toString("utf8"))
          : bytes.subarray(0, 2).toString("ascii") === "PK" &&
              !bytes.includes(Buffer.from("BOOT-INF/")),
        "SC_ARTIFACT_BACKEND_TYPE",
        "Maven artifacts must be POMs/plain libraries, not application JARs",
      );
      report.backend.push({ file: item.file, bytes: bytes.length, sha256: item.sha256 });
    }
    report.passed = true;
    return { manifest, report };
  } catch (error) {
    caughtError = error;
    throw error;
  } finally {
    if (temporary) await fs.rm(temporary, { recursive: true, force: true });
    report.temporaryDirectoryRemoved = !temporary || !existsSync(temporary);
    if (caughtError instanceof Error)
      caughtError.temporaryDirectoryRemoved = report.temporaryDirectoryRemoved;
    requireThat(
      report.temporaryDirectoryRemoved,
      "SC_ARTIFACT_TEMP_CLEANUP",
      "Temporary archive extraction was not removed",
    );
  }
}

async function cli() {
  let artifacts;
  let reportFile = path.join(ROOT, "docs/검증/011-package-artifacts.json");
  try {
    for (let i = 2; i < process.argv.length; i++) {
      const option = process.argv[i];
      if (option === "--artifacts") artifacts = process.argv[++i];
      else if (option === "--report") reportFile = process.argv[++i];
      else
        throw new PackageArtifactError(
          "SC_PACKAGE_ARGUMENT",
          "Only --artifacts and --report are supported",
        );
    }
    requireThat(
      typeof artifacts === "string" && typeof reportFile === "string",
      "SC_PACKAGE_ARGUMENT",
      "--artifacts directory is required",
    );
    reportFile = await validateReportPath(reportFile, artifacts);
    const { report } = await verifyArtifactDirectory(artifacts);
    await fs.mkdir(path.dirname(path.resolve(reportFile)), { recursive: true });
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + "\n");
    console.log(
      `PASS compiled artifacts: ${report.frontend.length} npm packages, ${report.backend.length} Maven files; temporary extraction removed`,
    );
  } catch (error) {
    const code = error instanceof PackageArtifactError ? error.code : "SC_PACKAGE_CHECKER_INTERNAL";
    const message =
      error instanceof PackageArtifactError
        ? error.message
        : code + ": Artifact checker failed before completion";
    if (typeof reportFile === "string" && code !== "SC_PACKAGE_REPORT_PATH") {
      await fs.mkdir(path.dirname(path.resolve(reportFile)), { recursive: true });
      await fs.writeFile(
        reportFile,
        JSON.stringify(
          {
            stage: "011",
            passed: false,
            code,
            message,
            context: error?.context ?? null,
            exceptionType: error?.constructor?.name ?? "Error",
            packageCodeExecuted: false,
            temporaryDirectoryRemoved: error?.temporaryDirectoryRemoved ?? false,
          },
          null,
          2,
        ) + "\n",
      );
    }
    console.error(message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await cli();
