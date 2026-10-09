import { createApp } from "vue";
import { createFrameworkRuntime, ApiError } from "@sc/runtime";
import { createScVuetify } from "@sc/ui";
import "vuetify/styles";
import "@sc/ui/styles";
import App from "./App.vue";
import LoginPage from "./features/auth/LoginPage.vue";
import NotesPage from "./features/notes/NotesPage.vue";
import { i18n } from "./localization";
import { patternsEnabled } from "./config";
const runtime = createFrameworkRuntime({
  unauthorizedPath: "/login",
  routes: [
    { path: "/login", name: "login", component: LoginPage },
    { path: "/", redirect: "/notes" },
    { path: "/notes/:id?", name: "notes", component: NotesPage },
    ...(patternsEnabled
      ? [
          {
            path: "/patterns",
            name: "patterns",
            component: () => import("./features/patterns/PatternsPage.vue"),
          },
        ]
      : []),
    { path: "/:pathMatch(.*)*", redirect: "/notes" },
  ],
});
let initialSession: Promise<unknown> | undefined;
runtime.router.beforeEach(async (to) => {
  if (to.name === "login" || runtime.session.identity) return true;
  if (!initialSession)
    initialSession = runtime.auth.syncIdentity().catch((error: unknown) => {
      if (!(error instanceof ApiError) || error.status !== 401)
        console.warn("SESSION_CHECK_FAILED");
    });
  await initialSession;
  return runtime.session.identity ? true : { name: "login" };
});
createApp(App).use(runtime).use(i18n).use(createScVuetify()).mount("#app");
