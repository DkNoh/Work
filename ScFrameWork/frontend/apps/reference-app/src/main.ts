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

runtime.router.beforeEach(async (to) => {
  if (to.meta.public || runtime.session.identity) return true;
  try {
    await runtime.auth.syncIdentity();
    return true;
  } catch {
    return { name: "login" };
  }
});

const app = createApp(App).use(runtime).use(i18n).use(createScVuetify());
installOperationsCollector(app, runtime);
app.mount("#app");
