/**
 * The Composition Root File
 * Implements the Dependency Inversion Principle (DIP):
 *
 * High-level modules should not depend on low-level modules; both should depend
 * on abstractions. Details should depend on abstractions, not vice versa.
 *
 * Key benefits in this application:
 * 1. Loose coupling: UI components, layouts, and pages do not instantiate concrete
 *    SDKs or databases directly. They receive contracts, services, or stores from above.
 * 2. Testability & mockability: Business logic and UI can be tested in isolation by
 *    swapping implementations with mocks or test doubles without touching component code.
 * 3. Flexibility & maintainability: Environment-specific variations (such as offline mode
 *    disabling auth persistence and sync) are configured centrally here in the Composition
 *    Root rather than leaking across page implementations.
 */

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
  // 1. Core infrastructure: client-side routing & remote backend client (Supabase)
  const router = new Router();
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: !config.isOfflineMode,
      autoRefreshToken: !config.isOfflineMode,
      detectSessionInUrl: !config.isOfflineMode,
    },
  });

  // 2. Authentication service & route protection guard
  const authService = new AuthService(supabase);
  const enforceAuthRoute = createAuthGuard(authService, router, { disabled: config.isOfflineMode });

  // 3. Local-first sync infrastructure: local SQLite (PowerSync) & backend connector
  const { powersync } = createPowerSync();
  const connector = new SupabasePowerSyncConnector(supabase, config.powersyncUrl);

  // 4. Sync lifecycle: connect on login and clean up local data on logout
  const syncLifecycle = createSyncLifecycle({
    connect: async () => {
      if (!config.isOfflineMode) await powersync.connect(connector);
    },
    reset: async () => {
      if (!config.isOfflineMode) await powersync.disconnectAndClear({ clearLocal: true });
    },
  });

  // 5. Auth controller: coordinates auth events with route navigation and sync lifecycle
  const auth = new AuthController({
    authService,
    router,
    syncLifecycle,
    enforceAuthRoute,
    isOfflineMode: config.isOfflineMode,
  });

  // 6. Data stores & navigation helpers for UI consumers
  const store = new TodoStore(powersync);
  const navigate = (path: string) => {
    router.navigate(path);
  };

  // 7. Composition Root: inject dependencies, layouts, and page factories into AppRoot
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
