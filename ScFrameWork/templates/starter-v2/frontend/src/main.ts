/**
 * 생성 앱의 브라우저 시작점이다. __APP_NAME__ 등 template placeholder는 생성기가 새 앱 이름/설정으로 치환한다.
 * 이 앱 전용 runtime과 Notes/로그인/선택 패턴/운영 라우트를 조립한다. API Controller 경로와 Vue Router 화면 경로는 별개다.
 * initialSession Promise를 공유하여 초기 라우트 이동이 겹쳐도 세션 조회를 중복 시작하지 않는다. 로그인 여부를 확인한 뒤 보호 화면으로 진입한다.
 */
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
import { installOperationsCollector } from "./features/operations/capabilities";
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
    { path: "/:pathMatch(.*)*", redirect: "/notes" },
  ],
});
let initialSession: Promise<unknown> | undefined;
/**
 * 로그인 화면은 공개하고 나머지는 서버 쿠키 세션의 identity를 확인한다. 오류 원문/비밀을 출력하지 않고 정해진 실패 코드만 알린다.
 */
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
/**
 * runtime→i18n→Vuetify를 등록하고 수집기를 연결한 뒤 #app에 화면을 붙인다.
 */
const app = createApp(App).use(runtime).use(i18n).use(createScVuetify());
installOperationsCollector(app, runtime);
app.mount("#app");
