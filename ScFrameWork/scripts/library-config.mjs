import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

/** 배포 JS에 vendor/peer를 복제하지 않는다. 알려지지 않은 bare import는 artifact 검사에서 거절한다. */
export function isBareSpecifier(id) {
  return (
    !id.startsWith(".") &&
    !path.isAbsolute(id) &&
    !id.startsWith("\0") &&
    !id.startsWith("virtual:")
  );
}

export function createLibraryConfig(configUrl, { vueComponents = false, ui = false } = {}) {
  const packageDirectory = path.dirname(fileURLToPath(configUrl));
  const entry = { index: path.join(packageDirectory, "src/index.ts") };
  if (ui) {
    const registry = JSON.parse(
      fs.readFileSync(path.join(packageDirectory, "source-entries.json"), "utf8"),
    );
    if (registry.format !== 1 || !registry.entries)
      throw new Error("UI source registry format must be 1");
    for (const [key, source] of Object.entries(registry.entries)) {
      if (!source.endsWith(".ts")) continue;
      entry[key === "." ? "index" : key.slice(2)] = path.resolve(packageDirectory, source);
    }
    entry.__styles = path.join(packageDirectory, "library/styles.ts");
  }
  return defineConfig({
    root: packageDirectory,
    plugins: vueComponents ? [vue()] : [],
    build: {
      target: "es2022",
      outDir: "dist",
      emptyOutDir: true,
      copyPublicDir: false,
      sourcemap: false,
      minify: false,
      cssCodeSplit: false,
      lib: {
        entry,
        formats: ["es"],
        fileName: (_format, name) => `${name}.js`,
        ...(ui ? { cssFileName: "sc-ui" } : {}),
      },
      rolldownOptions: {
        external: isBareSpecifier,
        output: { chunkFileNames: "chunks/[name]-[hash].js" },
      },
    },
  });
}
