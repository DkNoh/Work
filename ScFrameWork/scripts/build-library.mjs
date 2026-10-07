import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { build } from "vite";
import {
  libraryInputsDigest,
  normalizeDeclarations,
  writeThirdPartyNotices,
} from "./library-artifacts.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const allowed = new Set(["ui", "runtime", "date", "excel", "i18n"]);
async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`Library command failed: exit ${code}, signal ${signal ?? "none"}`)),
    );
  });
}
async function main() {
  if (process.argv.length !== 3)
    throw new Error("Usage: node scripts/build-library.mjs <package-directory>");
  const packageDirectory = await fs.realpath(path.resolve(process.cwd(), process.argv[2]));
  const name = path.basename(packageDirectory);
  if (!allowed.has(name) || packageDirectory !== path.join(repository, "frontend/packages", name))
    throw new Error("Only the five framework library packages can be built");
  const manifest = JSON.parse(
    await fs.readFile(path.join(packageDirectory, "package.json"), "utf8"),
  );
  if (manifest.name !== `@sc/${name}` || !manifest.private || manifest.license !== "UNLICENSED")
    throw new Error("Library package metadata is invalid");
  if (name === "ui")
    await run(
      process.execPath,
      [path.join(packageDirectory, "scripts/generate-tokens.mjs"), "--check"],
      packageDirectory,
    );
  await build({ configFile: path.join(packageDirectory, "vite.library.config.mjs") });
  const compiler =
    name === "date"
      ? require.resolve("typescript/bin/tsc")
      : require.resolve("vue-tsc/bin/vue-tsc.js");
  await run(process.execPath, [compiler, "-p", "tsconfig.build.json"], packageDirectory);
  const dist = path.join(packageDirectory, "dist");
  if (name === "runtime") {
    await fs.mkdir(path.join(dist, "types/generated"), { recursive: true });
    await fs.copyFile(
      path.join(packageDirectory, "src/generated/api.d.ts"),
      path.join(dist, "types/generated/api.d.ts"),
    );
  }
  if (name === "ui") {
    await fs.copyFile(
      path.join(packageDirectory, "src/tokens.scss"),
      path.join(dist, "tokens.scss"),
    );
    await fs.copyFile(
      path.join(repository, "docs/ui-contracts.json"),
      path.join(dist, "CONTRACTS.json"),
    );
    await fs.writeFile(
      path.join(dist, "types/styles.d.ts"),
      "// Side-effect CSS entry for browser bundlers.\nexport {};\n",
    );
    await fs.rm(path.join(dist, "__styles.js"));
  }
  await normalizeDeclarations(path.join(dist, "types"));
  await writeThirdPartyNotices(packageDirectory, manifest);
  await fs.writeFile(
    path.join(dist, "build-manifest.json"),
    `${JSON.stringify({ format: 1, name: manifest.name, version: manifest.version, inputsDigest: await libraryInputsDigest(packageDirectory) }, null, 2)}\n`,
  );
  process.stdout.write(
    `${manifest.name}@${manifest.version}: compiled ESM/declarations/assets ready\n`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
