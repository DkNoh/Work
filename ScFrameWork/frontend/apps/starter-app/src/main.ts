/**
 * 최소 Starter의 브라우저 시작점이다. Java의 main처럼 의존성을 조립하지만 실제 API와 DB는 별도 Spring 서버가 소유한다.
 * createFrameworkRuntime이 이 앱 전용 Router/Pinia 세션/Query/HTTP client를 만든다. 공개 @sc 패키지만 소비하며 업무 Reference 앱을 import하지 않는다.
 * 패턴 라우트는 공개 설정으로 선택하고 운영 라우트는 서버 capability로 표시를 제어한다. import()는 화면 이동 시 모듈을 읽는 지연 로딩이다.
 */
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
/**
 * 운영 URL 진입 때 기존 쿠키 세션을 확인한다. 세션이 없으면 운영 페이지의 로그인 폼을 사용하며 API 권한은 서버가 다시 검사한다.
 */
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
/**
 * 플러그인 등록 후 오류 수집기 수명을 연결하고 #app DOM에 화면을 마운트한다. Vue 컴포넌트의 setup은 각 인스턴스가 만들어질 때 실행된다.
 */
const app = createApp(App).use(runtime).use(i18n).use(createScVuetify());
installOperationsCollector(app, runtime);
app.mount("#app");
