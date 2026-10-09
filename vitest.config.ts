import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: [
      ...["table", "charts", "editor", "board", "image"].map((module) => ({
        find: new RegExp(`^@sc/ui/${module}$`),
        replacement: fileURLToPath(
          new URL(`./frontend/packages/ui/src/${module}/index.ts`, import.meta.url),
        ),
      })),
      ...["i18n", "excel", "date"].map((module) => ({
        find: new RegExp(`^@sc/${module}$`),
        replacement: fileURLToPath(
          new URL(`./frontend/packages/${module}/src/index.ts`, import.meta.url),
        ),
      })),
      {
        find: /^@sc\/ui$/,
        replacement: fileURLToPath(new URL("./frontend/packages/ui/src/index.ts", import.meta.url)),
      },
      {
        find: /^@sc\/runtime$/,
        replacement: fileURLToPath(
          new URL("./frontend/packages/runtime/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: "happy-dom",
    server: { deps: { inline: ["vuetify"] } },
    include: ["frontend/packages/**/src/**/*.spec.ts", "frontend/apps/**/src/**/*.spec.ts"],
    exclude: ["**/e2e/**", "**/node_modules/**", "**/dist/**", "**/*.stories.*"],
    restoreMocks: true,
  },
});
