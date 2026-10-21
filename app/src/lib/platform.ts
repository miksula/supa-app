/**
 * The Platform: stable infrastructure wiring.
 *
 * Creates the long-lived plumbing (router, Supabase, auth, PowerSync, sync
 * lifecycle, shell layouts) and exposes only narrow handles to it. The
 * composition root in `main.ts` consumes this and wires the actively developed
 * parts (data stores, pages, navigation) on top, without importing any SDK.
 */

import { Router } from "@packages/router";
import { createClient } from "@supabase/supabase-js";
import { config } from "./config.ts";
import { AuthService } from "./auth/AuthService.ts";
import { createAuthController } from "./auth/AuthController.ts";
import { createAuthGuard } from "./auth/authGuard.ts";
import { createPowerSync } from "./sync/client.ts";
import { SupabasePowerSyncConnector } from "./sync/SupabasePowerSyncConnector.ts";
import { createSyncLifecycle } from "./sync/syncLifecycle.ts";
import { SyncController } from "./sync/SyncController.ts";
import type { NavItem } from "./nav/navConfig.ts";
import { SidebarLayout } from "./shell/SidebarLayout.ts";
import { LoginLayout } from "./shell/LoginLayout.ts";

type PlatformOptions = {
  navItems: NavItem[];
};

export function createPlatform({ navItems }: PlatformOptions) {
  // Client-side routing & remote backend client (Supabase)
  const router = new Router();
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: !config.isOfflineMode,
      autoRefreshToken: !config.isOfflineMode,
      detectSessionInUrl: !config.isOfflineMode,
    },
  });

  // Authentication service & route protection guard
  const authService = new AuthService(supabase);
  const enforceAuthRoute = createAuthGuard(authService, router, { disabled: config.isOfflineMode });

  // Local-first sync infrastructure: local SQLite (PowerSync) & backend connector
  const powersync = createPowerSync();
  const connector = new SupabasePowerSyncConnector(supabase, config.powersyncUrl);

  // Sync lifecycle: connect on login and clean up local data on logout
  const syncLifecycle = createSyncLifecycle({
    connect: async () => {
      if (!config.isOfflineMode) await powersync.connect(connector);
    },
    reset: async () => {
      if (!config.isOfflineMode) await powersync.disconnectAndClear({ clearLocal: true });
    },
  });

  // Auth controller: coordinates auth events with route navigation and sync lifecycle
  const auth = createAuthController({
    authService,
    router,
    syncLifecycle,
    enforceAuthRoute,
    isOfflineMode: config.isOfflineMode,
  });

  return {
    /** Handles for feature code (stores, pages). */
    config,
    router,
    db: powersync,
    navigate: (path: string) => {
      router.navigate(path);
    },
    session: {
      login: (email: string, password: string) => authService.login(email, password),
      userId: () => authService.session?.user.id ?? null,
    },
    /** Pieces `AppRoot` needs; feature code should not touch these. */
    shell: {
      auth,
      enforceAuthRoute,
      mountSync: (target: HTMLElement) =>
        SyncController(target, { powersync, isOfflineMode: config.isOfflineMode }),
      layouts: {
        app: (target: HTMLElement) => SidebarLayout(target, { router, navItems, authService }),
        login: LoginLayout,
      },
    },
  };
}
