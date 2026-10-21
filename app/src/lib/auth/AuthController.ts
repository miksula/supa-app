import type { AppRouter } from "@/types.ts";
import type { createSyncLifecycle } from "@/sync/syncLifecycle.ts";
import type { AuthService } from "./AuthService.ts";

type AuthControllerDependencies = {
  authService: Pick<AuthService, "ready" | "init" | "session" | "onAuthStateChange">;
  router: Pick<AppRouter, "path" | "check" | "navigate">;
  syncLifecycle: ReturnType<typeof createSyncLifecycle>;
  enforceAuthRoute: (path: string) => boolean;
  isOfflineMode: boolean;
};

export function createAuthController(dependencies: AuthControllerDependencies) {
  return {
    async bootstrap() {
      const { authService, router, syncLifecycle, enforceAuthRoute, isOfflineMode } = dependencies;
      if (isOfflineMode) {
        authService.ready = true;
        router.check();
        return;
      }

      try {
        await authService.init();

        // Single auth subscription, fanned out to sync and the route guard.
        authService.onAuthStateChange(async (event, session) => {
          await syncLifecycle.handle(event, session);
          enforceAuthRoute(router.path);
        });

        await syncLifecycle.start(authService.session);

        if (!enforceAuthRoute(router.path)) {
          router.check();
        }
      } catch (error) {
        console.error("Failed to bootstrap authentication", error);
        router.navigate("/auth");
      }
    },
  };
}
