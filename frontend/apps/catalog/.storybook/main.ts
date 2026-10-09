import type { StorybookConfig } from "@storybook/vue3-vite";
import vue from "@vitejs/plugin-vue";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.ts"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/vue3-vite",
    options: {
      // import한 공개 props/emits/slots 타입도 문서의 원본으로 사용한다.
      // Storybook의 project root는 npm workspace 루트다.
      docgen: {
        plugin: "vue-component-meta",
        tsconfig: "frontend/apps/catalog/tsconfig.docgen.json",
      },
    },
  },
  staticDirs: ["../public"],
  async viteFinal(base) {
    // SFC 컴파일 뒤에 docgen이 _sfc_main에 공개 계약을 연결해야 한다.
    const merged = mergeConfig(base, {
      // 최초 실행 중 뒤늦은 최적화가 browser test iframe을 재시작하지 않게 한다.
      optimizeDeps: { include: ["vee-validate", "zod", "axe-core", "@mdi/js"] },
      server: {
        fs: {
          // catalog에서도 workspace의 실행 자료·비밀 파일을 HTTP로 노출하지 않는다.
          deny: [
            ".env",
            ".env.*",
            "*.{crt,pem,key,p12,pfx,cer,der}",
            ".npmrc",
            ".yarnrc.yml",
            "**/.git/**",
            "**/.runtime/**",
            "**/*.secret",
            "**/*.mv.db",
            "**/*.trace.db",
          ],
        },
      },
    });
    merged.plugins = [vue(), ...(base.plugins ?? [])];
    return merged;
  },
};
export default config;
