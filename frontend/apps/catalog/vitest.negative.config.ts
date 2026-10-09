import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    reporters: ["verbose", "json"],
    outputFile: process.env.SC_A11Y_GATE_REPORT
      ? { json: process.env.SC_A11Y_GATE_REPORT }
      : undefined,
    projects: [
      {
        plugins: [
          storybookTest({
            configDir: fileURLToPath(new URL("./.storybook-negative", import.meta.url)),
          }),
        ],
        test: {
          name: "storybook-a11y-negative",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: process.env.CHROME_BIN
                ? { executablePath: process.env.CHROME_BIN }
                : {},
            }),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
