/**
 * Reference 애플리케이션의 브라우저 시작점. Java의 main/설정 클래스처럼 모듈을 조립하지만 서버 프로세스를 만들지는 않는다.
 * createFrameworkRuntime은 이 앱 전용 Router·Pinia 세션·Vue Query·HTTP client를 연결한다. 다른 업무 앱의 인스턴스를 공유하지 않는다.
 * routes는 화면 URL과 Vue 컴포넌트의 대응표다. API Controller 경로와 별개이며 로그인 화면만 public으로 표시한다.
 * 화살표 함수 안의 import()는 해당 화면으로 이동할 때 코드를 읽는 지연 로딩이다. import type은 컴파일 후 사라지는 타입 참조다.
 */
import { createApp } from "vue";
import { createFrameworkRuntime } from "@sc/runtime";
import { createScVuetify } from "@sc/ui";
import "vuetify/styles";
import "@sc/ui/styles";
import App from "./App.vue";
import { i18n } from "./localization";
import LoginPage from "./features/auth/LoginPage.vue";
import ExamplesPage from "./features/examples/ExamplesPage.vue";
import { decodeReferenceIdentity, type ReferenceIdentity } from "./auth/identity";
import { installOperationsCollector } from "./features/operations/capabilities";

/**
 * <ReferenceIdentity>는 Java 제네릭처럼 로그인 사용자 타입을 지정한다. 실제 JSON 검증은 decodeIdentity가 별도로 수행한다.
 */
const runtime = createFrameworkRuntime<ReferenceIdentity>({
  decodeIdentity: decodeReferenceIdentity,
  unauthorizedPath: "/login",
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/login", name: "login", component: LoginPage, meta: { public: true } },
    {
      path: "/dashboard",
      name: "dashboard",
      component: () => import("./features/dashboard/DashboardPage.vue"),
    },
    { path: "/examples", name: "examples", component: ExamplesPage },
    {
      path: "/requests",
      name: "requests",
      component: () => import("./features/requirements/RequirementsPage.vue"),
    },
    {
      path: "/reports/requirements",
      name: "requirement-report",
      component: () => import("./features/reports/requirements/RequirementReportPage.vue"),
    },
    {
      path: "/requests/:id(\\d+)",
      name: "request-detail",
      component: () => import("./features/requirements/RequirementWorkspace.vue"),
    },
    {
      path: "/workspace",
      name: "workspace",
      component: () => import("./features/requirements/RequirementWorkspace.vue"),
    },
    {
      path: "/patterns",
      name: "patterns",
      component: () => import("./features/patterns/PatternsPage.vue"),
    },
    { path: "/admin", redirect: "/admin/users" },
    {
      path: "/admin/users",
      name: "admin-users",
      component: () => import("./features/admin/AdminUsersPage.vue"),
    },
    {
      path: "/admin/menus",
      name: "admin-menus",
      component: () => import("./features/admin/AdminMenusPage.vue"),
    },
    {
      path: "/admin/audit",
      name: "admin-audit",
      component: () => import("./features/admin/AdminAuditPage.vue"),
    },
    {
      path: "/account",
      name: "account",
      component: () => import("./features/account/AccountPage.vue"),
    },
    {
      path: "/screens",
      name: "screens",
      component: () => import("./features/media/MediaWorkspacePage.vue"),
    },
    {
      path: "/kanban",
      name: "kanban",
      component: () => import("./features/kanban/KanbanPage.vue"),
    },
    {
      path: "/notices",
      name: "notices",
      component: () => import("./features/notices/NoticesPage.vue"),
    },
    {
      path: "/notices/new",
      name: "notices-new",
      component: () => import("./features/notices/NoticesPage.vue"),
    },
    {
      path: "/notices/:id(\\d+)",
      name: "notice-detail",
      component: () => import("./features/notices/NoticesPage.vue"),
    },
    {
      path: "/documents",
      name: "documents",
      component: () => import("./features/documents/DocumentsPage.vue"),
    },
    {
      path: "/documents/new",
      name: "documents-new",
      component: () => import("./features/documents/DocumentsPage.vue"),
    },
    {
      path: "/documents/:id(\\d+)",
      name: "document-detail",
      component: () => import("./features/documents/DocumentsPage.vue"),
    },
    {
      path: "/operations/messages",
      name: "operations-messages",
      component: () => import("./features/operations/MessagesPage.vue"),
    },
    {
      path: "/operations/schedules",
      name: "operations-schedules",
      component: () => import("./features/operations/SchedulesPage.vue"),
    },
    {
      path: "/operations/browser-errors",
      name: "operations-browser-errors",
      component: () => import("./features/operations/BrowserErrorsPage.vue"),
    },
    { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
  ],
});

/**
 * 각 화면 이동 전에 실행하는 비동기 가드다. JSP 요청마다 서버에서 세션을 확인하는 방식과 달리 브라우저 라우트 이동에도 동작한다.
 * 현재 브라우저에 사용자 정보가 없으면 쿠키 세션으로 /auth/me를 조회한다. 최종 API 권한 검사는 항상 서버가 다시 수행한다.
 */
runtime.router.beforeEach(async (to) => {
  if (to.meta.public || runtime.session.identity) return true;
  try {
    await runtime.auth.syncIdentity();
    return true;
  } catch {
    return { name: "login" };
  }
});

/**
 * use()는 앱별 플러그인을 등록한다. runtime을 먼저 제공해야 하위 화면의 useReferenceRuntime()이 같은 의존성을 받을 수 있다.
 * mount는 index.html의 #app에 최초 화면을 연결한다. 이후 화면 변경은 Router가 담당한다.
 */
const app = createApp(App).use(runtime).use(i18n).use(createScVuetify());
installOperationsCollector(app, runtime);
app.mount("#app");
