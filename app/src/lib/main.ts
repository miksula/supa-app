/**
 * Composition root: the only place that creates concrete services (router,
 * Supabase, PowerSync) and wires them into layouts and pages. Everything else
 * receives what it needs as arguments, so it can be tested with plain fakes.
 */
import { Router } from "@packages/router";
import { createClient } from "@supabase/supabase-js";
import { html, render } from "lit";
import { AppRoot } from "./AppRoot.ts";
import { config } from "./config.ts";
import { AuthService, type AppAuthService } from "./auth/AuthService.ts";
import { LocalAuthService } from "./auth/LocalAuthService.ts";
import { createAuthGuard } from "./auth/authGuard.ts";
import { bootstrapAuth } from "./auth/bootstrapAuth.ts";
import { createLocalUserStore } from "./auth/localUserStore.ts";
import { createPowerSync } from "./sync/client.ts";
import { runLocalMigrations } from "./sync/localMigrations.ts";
import { requestPersistentStorage } from "./sync/storagePersistence.ts";
import { SupabasePowerSyncConnector } from "./sync/SupabasePowerSyncConnector.ts";
import { createSyncLifecycle, type SyncLifecycle } from "./sync/syncLifecycle.ts";
import {
  createLocalOnlyStatusSource,
  createSyncStatusSource,
  type SyncStatusSource,
} from "./sync/syncStatus.ts";
import { NAV_ITEMS } from "./nav/navConfig.ts";
import { SidebarLayout } from "./shell/SidebarLayout.ts";
import { LoginLayout } from "./shell/LoginLayout.ts";
import { LoginPage } from "../pages/auth/LoginPage.ts";
import { MyTodosPage } from "../pages/my-todos/MyTodosPage.ts";
import { TodoStore } from "../pages/my-todos/TodoStore.ts";
import { DocsPage } from "../pages/docs/DocsPage.ts";
import { SettingsPage } from "../pages/settings/SettingsPage.ts";
import { NotFoundPage } from "../pages/not-found/NotFoundPage.ts";

export function startApp(el: HTMLElement) {
  const offline = config.isOfflineMode;
  const router = new Router();
  const navigate = (path: string) => {
    router.navigate(path);
  };

  const powersync = createPowerSync({ localOnly: offline });
  const todoStore = new TodoStore(powersync, { localOnly: offline });

  let authService: AppAuthService;
  let syncLifecycle: SyncLifecycle;
  let syncStatus: SyncStatusSource;

  if (offline) {
    authService = new LocalAuthService({
      email: config.localAuthEmail,
      password: config.localAuthPassword,
    });
    // Sign-out must never reset the database in Local-Only Mode.
    syncLifecycle = { start: async () => {}, handleAuthEvent: async () => {} };
    syncStatus = createLocalOnlyStatusSource();
    void requestPersistentStorage();
  } else {
    const supabase = createClient(config.supabaseUrl, config.supabaseKey);
    const userStore = createLocalUserStore();
    const connector = new SupabasePowerSyncConnector(supabase, config.powersyncUrl);
    authService = new AuthService(supabase, userStore);
    syncLifecycle = createSyncLifecycle({
      connect: () => powersync.connect(connector),
      reset: () => powersync.disconnectAndClear({ clearLocal: true }),
      userStore,
    });
    syncStatus = createSyncStatusSource(powersync);
  }

  const guardRoute = createAuthGuard(authService, router);
  const getUserId = () => authService.userId;

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
      settings: (target) =>
        SettingsPage(target, { backup: todoStore, getUserId, canImport: offline }),
      notFound: NotFoundPage,
    },
  });

  const start = async () => {
    if (offline) await runLocalMigrations(powersync);
    await bootstrapAuth({ authService, router, syncLifecycle, guardRoute });
  };

  void start().catch((error) => {
    console.error("Failed to upgrade the local database", error);
    render(
      html`
        <p role="alert">
          The local database couldn't be upgraded. Your data hasn't changed. Reload to try again.
        </p>
      `,
      el,
    );
  });

  return dispose;
}
