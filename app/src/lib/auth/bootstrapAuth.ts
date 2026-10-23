import type { AppRouter } from "@/types.ts";
import type { SyncLifecycle } from "@/sync/syncLifecycle.ts";
import type { AuthService } from "./AuthService.ts";
import type { RouteGuard } from "./authGuard.ts";

type BootstrapAuthDependencies = {
  authService: Pick<AuthService, "init" | "session" | "isAuthenticated" | "onAuthStateChange">;
  router: Pick<AppRouter, "path" | "check" | "navigate">;
  syncLifecycle: SyncLifecycle;
  guardRoute: RouteGuard;
};

/**
 * Startup sequence for online mode: restore the session, start sync, then render
 * the current route. Afterwards, every auth change goes to sync first and then
 * re-checks the route (e.g. sign-out redirects to `/auth`).
 */
export async function bootstrapAuth({
  authService,
  router,
  syncLifecycle,
  guardRoute,
}: BootstrapAuthDependencies) {
  try {
    await authService.init();

    authService.onAuthStateChange(async (event, session) => {
      await syncLifecycle.handleAuthEvent(event, session);
      guardRoute(router.path);
    });

    await syncLifecycle.start(authService.session, {
      hasFallbackUser: authService.isAuthenticated,
    });

    if (!guardRoute(router.path)) {
      router.check();
    }
  } catch (error) {
    console.error("Failed to bootstrap authentication", error);
    router.navigate("/auth");
  }
}
