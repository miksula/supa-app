/**
 * Composition root: the only place that creates concrete services (router,
 * Supabase, PowerSync) and wires them into layouts and pages. Everything else
 * receives what it needs as arguments, so it can be tested with plain fakes.
 */
import { Router } from "@packages/router";
import { createClient } from "@supabase/supabase-js";
import { AppRoot } from "./AppRoot.ts";
import { config } from "./config.ts";
import { AuthService } from "./auth/AuthService.ts";
import { createAuthGuard } from "./auth/authGuard.ts";
import { bootstrapAuth } from "./auth/bootstrapAuth.ts";
import { createLocalUserStore, OFFLINE_USER_ID } from "./auth/localUserStore.ts";
import { createPowerSync } from "./sync/client.ts";
import { SupabasePowerSyncConnector } from "./sync/SupabasePowerSyncConnector.ts";
import { createSyncLifecycle } from "./sync/syncLifecycle.ts";
import { createSyncStatusSource } from "./sync/syncStatus.ts";
import { NAV_ITEMS } from "./nav/navConfig.ts";
import { SidebarLayout } from "./shell/SidebarLayout.ts";
import { LoginLayout } from "./shell/LoginLayout.ts";
import { LoginPage } from "../pages/auth/LoginPage.ts";
import { MyTodosPage } from "../pages/my-todos/MyTodosPage.ts";
import { TodoStore } from "../pages/my-todos/TodoStore.ts";
import { DocsPage } from "../pages/docs/DocsPage.ts";
import { NotFoundPage } from "../pages/not-found/NotFoundPage.ts";

export function startApp(el: HTMLElement) {
  const offline = config.isOfflineMode;

  const router = new Router();
  const navigate = (path: string) => {
    router.navigate(path);
  };
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: !offline, autoRefreshToken: !offline, detectSessionInUrl: !offline },
  });
  const userStore = createLocalUserStore();
  const authService = new AuthService(supabase, userStore);
  const powersync = createPowerSync();
  const syncStatus = createSyncStatusSource(powersync);
  const todoStore = new TodoStore(powersync);

  // Offline mode has no backend: every route is open and sync never starts.
  const guardRoute = offline ? () => false : createAuthGuard(authService, router);
  const getUserId = offline
    ? () => authService.userId ?? userStore.get() ?? OFFLINE_USER_ID
    : () => authService.userId;

  const dispose = AppRoot(el, {
    router,
    guardRoute,
    layouts: {
      app: (target) =>
        SidebarLayout(target, { router, navItems: NAV_ITEMS, authService, syncStatus }),
      login: LoginLayout,
    },
    pages: {
      login: (target) =>
        LoginPage(target, {
          login: (email, password) => authService.login(email, password),
          initialEmail: config.devEmail,
          initialPassword: config.devPassword,
        }),
      todos: (target) =>
        MyTodosPage(target, {
          store: todoStore,
          getUserId,
        }),
      docs: (target, docId) => DocsPage(target, { docId, navigate }),
      notFound: NotFoundPage,
    },
  });

  // Routes are registered above; now render the current one.
  if (offline) {
    router.check();
  } else {
    const connector = new SupabasePowerSyncConnector(supabase, config.powersyncUrl);
    const syncLifecycle = createSyncLifecycle({
      connect: () => powersync.connect(connector),
      reset: () => powersync.disconnectAndClear({ clearLocal: true }),
      userStore,
    });
    void bootstrapAuth({ authService, router, syncLifecycle, guardRoute });
  }

  return dispose;
}
