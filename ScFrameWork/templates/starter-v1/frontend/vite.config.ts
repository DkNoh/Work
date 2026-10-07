import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [vue(), vuetify({ autoImport: true })],
  server: {
    port: __FRONTEND_PORT__,
    strictPort: true,
    fs: {
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem,key,p12,pfx,cer,der}",
        ".npmrc",
        "**/.git/**",
        "**/.runtime/**",
        "**/*.secret",
        "**/*.mv.db",
        "**/*.trace.db",
      ],
    },
    proxy: {
      "/api": {
        target: process.env.SC_API_TARGET ?? "http://127.0.0.1:__SERVER_PORT__",
        changeOrigin: true,
      },
    },
  },
});
