import { createApp } from "vue";
import { createFrameworkRuntime } from "@sc/runtime";
import { createScVuetify } from "@sc/ui";
import "vuetify/styles";
import "@sc/ui/styles";
import App from "./App.vue";
import { i18n } from "./localization";
import { patternsEnabled } from "./config";
import StartPage from "./StartPage.vue";
import { installOperationsCollector } from "./features/operations/capabilities";

const runtime = createFrameworkRuntime({
  routes: [
    { path: "/", name: "start", component: StartPage },
    ...(patternsEnabled
      ? [
          {
            path: "/patterns",
            name: "patterns",
            component: () => import("./features/patterns/PatternsPage.vue"),
          },
        ]
      : []),
    {
      path: "/operations/messages",
      name: "operations-messages",
      component: () => import("./features/operations/OperationsPage.vue"),
    },
    {
      path: "/operations/schedules",
      name: "operations-schedules",
      component: () => import("./features/operations/OperationsPage.vue"),
    },
    {
      path: "/operations/browser-errors",
      name: "operations-browser-errors",
      component: () => import("./features/operations/OperationsPage.vue"),
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
runtime.router.beforeEach(async (to) => {
  if (
    typeof to.name === "string" &&
    to.name.startsWith("operations-") &&
    !runtime.session.identity
  ) {
    try {
      await runtime.auth.syncIdentity();
    } catch {
      /* 운영 예제의 로그인 폼에서 세션을 시작한다. */
    }
  }
  return true;
});
const app = createApp(App).use(runtime).use(i18n).use(createScVuetify());
installOperationsCollector(app, runtime);
app.mount("#app");
