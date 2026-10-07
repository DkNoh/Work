import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  server: {
    port: 5176,
    fs: {
      // 모노레포 루트가 허용되어도 실행 자료와 비밀 파일은 정적으로 제공하지 않는다.
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
    proxy: {
      "/api": { target: process.env.SC_API_TARGET ?? "http://127.0.0.1:18082", changeOrigin: true },
    },
  },
});
