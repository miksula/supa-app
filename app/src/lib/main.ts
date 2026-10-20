import { Router } from "@packages/router";
import { createClient } from "@supabase/supabase-js";
import { config } from "./config.ts";
import { AppRoot } from "./AppRoot.ts";
import { AuthService } from "./auth/AuthService.ts";
import { AuthController } from "./auth/AuthController.ts";
import { createAuthGuard } from "./auth/authGuard.ts";
import { createPowerSync } from "./sync/client.ts";
import { SupabasePowerSyncConnector } from "./sync/SupabasePowerSyncConnector.ts";
import { createSyncLifecycle } from "./sync/syncLifecycle.ts";
import { SyncController } from "./sync/SyncController.ts";
import { NAV_ITEMS } from "./nav/navConfig.ts";
import { SidebarLayout } from "./shell/SidebarLayout.ts";
import { LoginLayout } from "./shell/LoginLayout.ts";
import { LoginPage } from "../pages/auth/index.ts";
import { MyTodosPage } from "../pages/my-todos/index.ts";
import { TodoStore } from "../pages/my-todos/TodoStore.ts";
import { DocsPage } from "../pages/docs/index.ts";
import { NotFoundPage } from "../pages/not-found/index.ts";

export function startApp(el: HTMLElement) {
  const router = new Router();
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: !config.isOfflineMode,
      autoRefreshToken: !config.isOfflineMode,
      detectSessionInUrl: !config.isOfflineMode,
    },
  });
  const authService = new AuthService(supabase);
  const { powersync } = createPowerSync();
  const connector = new SupabasePowerSyncConnector(supabase, config.powersyncUrl);
  const enforceAuthRoute = createAuthGuard(authService, router, { disabled: config.isOfflineMode });
  const syncLifecycle = createSyncLifecycle({
    connect: async () => {
      if (!config.isOfflineMode) await powersync.connect(connector);
    },
    reset: async () => {
      if (!config.isOfflineMode) await powersync.disconnectAndClear({ clearLocal: true });
    },
  });
  const auth = new AuthController({
    authService,
    router,
    syncLifecycle,
    enforceAuthRoute,
    isOfflineMode: config.isOfflineMode,
  });
  const store = new TodoStore(powersync);
  const navigate = (path: string) => {
    router.navigate(path);
  };

  AppRoot(el, {
    router,
    auth,
    enforceAuthRoute,
    mountSync: (target) =>
      SyncController(target, { powersync, isOfflineMode: config.isOfflineMode }),
    layouts: {
      app: (target) => SidebarLayout(target, { router, navItems: NAV_ITEMS, authService }),
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
          store,
          getUserId: () => authService.session?.user.id ?? null,
        }),
      docs: (target, docId) => DocsPage(target, { docId, navigate }),
      notFound: NotFoundPage,
    },
  });
}
