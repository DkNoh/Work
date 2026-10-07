import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import vue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/target/**",
      "**/storybook-static/**",
      "**/src/generated/**",
      "**/test-results/**",
      "**/test-results-reports/**",
      "**/test-results-operations/**",
      "**/playwright-report/**",
      ".runtime/**",
      "frontend/apps/catalog/public/mockServiceWorker.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.{js,mjs,ts,vue}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)) },
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)),
      },
    },
  },
  prettier,
];
